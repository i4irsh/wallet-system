import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdempotencyService, IdempotencyStatus } from '../idempotency.service';
import { IDEMPOTENCY_KEY_HEADER, REQUIRE_IDEMPOTENCY_KEY } from '../idempotency.decorator';

@Injectable()
export class IdempotencyGuard implements CanActivate {
    private readonly logger = new Logger(IdempotencyGuard.name);

    constructor(
        private readonly idempotencyService: IdempotencyService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        // Check if route requires idempotency
        const requireIdempotency = this.reflector.getAllAndOverride<boolean>(
            REQUIRE_IDEMPOTENCY_KEY,
            [context.getHandler(), context.getClass()],
        );

        const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER];

        // If route requires idempotency but no key provided
        if (requireIdempotency && !idempotencyKey) {
            throw new HttpException(
                {
                    statusCode: HttpStatus.BAD_REQUEST,
                    message: `Header '${IDEMPOTENCY_KEY_HEADER}' is required for this operation`,
                    error: 'Bad Request',
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        // If no idempotency key provided and not required, allow request
        if (!idempotencyKey) {
            this.logger.debug('No idempotency key provided, proceeding without check');
            return true;
        }

        // Store idempotency key in request for interceptor
        request.idempotencyKey = idempotencyKey;

        const result = await this.idempotencyService.checkAndLock(idempotencyKey);

        if (!result.isDuplicate) {
            // New request, proceed
            return true;
        }

        if (result.status === IdempotencyStatus.IN_PROGRESS) {
            // Request is being processed by another instance
            throw new HttpException(
                {
                    statusCode: HttpStatus.CONFLICT,
                    message: 'Request is already being processed',
                    idempotencyKey,
                },
                HttpStatus.CONFLICT,
            );
        }

        if (result.status === IdempotencyStatus.COMPLETED) {
            // Return cached response
            this.logger.log(`Returning cached response for idempotency key: ${idempotencyKey}`);

            // Set response headers and body
            response.status(HttpStatus.OK).json({
                ...result.response,
                _cached: true,
                _idempotencyKey: idempotencyKey,
            });

            return false; // Prevent further processing
        }

        return true;
    }
}