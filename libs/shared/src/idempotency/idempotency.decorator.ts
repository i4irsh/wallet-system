import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export const IDEMPOTENCY_KEY_HEADER = 'x-idempotency-key';
export const REQUIRE_IDEMPOTENCY_KEY = 'requireIdempotencyKey';

// Decorator to extract idempotency key (optional use in controller)
export const IdempotencyKey = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers[IDEMPOTENCY_KEY_HEADER];
  },
);

// Decorator to mark routes that REQUIRE idempotency key
export const RequireIdempotency = () =>
  SetMetadata(REQUIRE_IDEMPOTENCY_KEY, true);
