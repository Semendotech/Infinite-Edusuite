/**
 * Custom error classes for the application
 */

export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Not Found
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // Conflict
  CONFLICT = 'CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  
  // Server Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Business Logic
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: Record<string, any>) {
    super(message, ErrorCode.UNAUTHORIZED, 401, true, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: Record<string, any>) {
    super(message, ErrorCode.FORBIDDEN, 403, true, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: Record<string, any>) {
    super(`${resource} not found`, ErrorCode.NOT_FOUND, 404, true, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, ErrorCode.CONFLICT, 409, true, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: Record<string, any>) {
    super(message, ErrorCode.DATABASE_ERROR, 500, false, details);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, ErrorCode.BUSINESS_RULE_VIOLATION, 400, true, details);
  }
}

/**
 * Error handler utility functions
 */

/**
 * Check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('Unauthorized') || error.message.includes('auth')) {
      return new UnauthorizedError(error.message);
    }
    
    if (error.message.includes('not found') || error.message.includes('Not Found')) {
      return new NotFoundError(error.message);
    }
    
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return new ValidationError(error.message);
    }
    
    // Generic error
    return new AppError(error.message, ErrorCode.INTERNAL_ERROR, 500, false);
  }

  return new AppError('An unknown error occurred', ErrorCode.INTERNAL_ERROR, 500, false);
}

/**
 * Log error with context
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const appError = toAppError(error);
  
  console.error('[Error]', {
    message: appError.message,
    code: appError.code,
    statusCode: appError.statusCode,
    isOperational: appError.isOperational,
    details: appError.details,
    context,
    stack: appError.stack,
  });
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: unknown): {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, any>;
  };
} {
  const appError = toAppError(error);
  
  return {
    success: false,
    error: {
      message: appError.message,
      code: appError.code,
      details: appError.details,
    },
  };
}

/**
 * Handle error in try-catch blocks
 * Returns formatted error response
 */
export function handleError(error: unknown, context?: Record<string, any>) {
  logError(error, context);
  return formatErrorResponse(error);
}

/**
 * Async error wrapper for server functions
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error);
      throw toAppError(error);
    }
  }) as T;
}

/**
 * Supabase error handler
 */
export function handleSupabaseError(error: any): AppError {
  if (!error) {
    return new DatabaseError('Unknown database error');
  }

  const message = error.message || 'Database operation failed';
  const code = error.code;
  const details = error.details;

  // Handle specific Supabase error codes
  switch (code) {
    case '23505': // Unique violation
      return new ConflictError('A record with this information already exists', { details });
    
    case '23503': // Foreign key violation
      return new ValidationError('Referenced record does not exist', { details });
    
    case '23502': // Not null violation
      return new ValidationError('Required field is missing', { details });
    
    case 'PGRST116': // Not found
      return new NotFoundError('Resource not found', { details });
    
    case 'PGRST301': // Unauthorized
      return new UnauthorizedError('Unauthorized access', { details });
    
    default:
      return new DatabaseError(message, { code, details });
  }
}
