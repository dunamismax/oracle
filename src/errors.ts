export const ErrorType = {
  API: "api_error",
  NOT_FOUND: "not_found_error",
  RATE_LIMIT: "rate_limit_error",
  NETWORK: "network_error",
  VALIDATION: "validation_error",
  UNKNOWN: "unknown_error",
  DEPENDENCY: "dependency_error",
  PERMISSION: "permission_error",
} as const;

export type ErrorType = (typeof ErrorType)[keyof typeof ErrorType];

export class BotError extends Error {
  readonly errorType: ErrorType;
  override readonly cause?: unknown;

  constructor(errorType: ErrorType, message: string, cause?: unknown) {
    super(message);
    this.name = "BotError";
    this.errorType = errorType;
    this.cause = cause;
  }
}

export function createError(
  errorType: ErrorType,
  message: string,
  cause?: unknown,
): BotError {
  return new BotError(errorType, message, cause);
}
