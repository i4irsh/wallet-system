import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { IdempotencyService } from '../idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.idempotencyKey;

    // If no idempotency key, just proceed normally
    if (!idempotencyKey) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        // Store successful response
        await this.idempotencyService.complete(idempotencyKey, response);
        this.logger.debug(
          `Stored response for idempotency key: ${idempotencyKey}`,
        );
      }),
      catchError(async (error) => {
        // Release lock on error to allow retry
        await this.idempotencyService.release(idempotencyKey);
        this.logger.debug(
          `Released idempotency key on error: ${idempotencyKey}`,
        );
        throw error;
      }),
    );
  }
}
