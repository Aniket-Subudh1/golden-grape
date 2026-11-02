export type ErrorCode = 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'OUT_OF_STOCK' | 'RATE_LIMITED';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string = code,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
