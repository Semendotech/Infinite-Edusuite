/**
 * Global Unauthorized Handler
 * 
 * System-wide handling for:
 * - Unauthorized route access
 * - Expired sessions
 * - Missing permissions
 * 
 * Provides:
 * - Redirect logic
 * - Toast notification integration
 * - Audit event emission
 * - Consistent error messaging
 */

import { toast } from 'sonner';
import { emit } from '@/core/events/event-system';

/**
 * Unauthorized error types
 */
export enum UnauthorizedErrorType {
  UNAUTHENTICATED = 'unauthenticated',
  UNAUTHORIZED = 'unauthorized',
  NO_BRANCH = 'no_branch',
  EXPIRED_SESSION = 'expired_session',
  INVALID_TOKEN = 'invalid_token',
}

/**
 * Unauthorized error context
 */
export interface UnauthorizedErrorContext {
  type: UnauthorizedErrorType;
  userId?: string;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  attemptedPath?: string;
  timestamp: Date;
}

/**
 * Handle unauthorized access
 * 
 * @param error - Error context
 * @param options - Handler options
 */
export function handleUnauthorized(
  error: UnauthorizedErrorContext,
  options: {
    showToast?: boolean;
    emitEvent?: boolean;
    redirectPath?: string;
  } = {}
): void {
  const {
    showToast = true,
    emitEvent: shouldEmitEvent = true,
    redirectPath,
  } = options;

  // Show toast notification
  if (showToast) {
    const message = getErrorMessage(error);
    toast.error(message, {
      description: getErrorDescription(error),
      duration: 5000,
    });
  }

  // Emit audit event
  if (shouldEmitEvent) {
    emit('audit:logged', {
      auditId: crypto.randomUUID(),
      action: 'unauthorized_access_attempt',
      entityType: 'route',
      entityId: error.attemptedPath || 'unknown',
    } as any);
  }

  // Log to console for debugging
  console.warn('[UnauthorizedHandler]', error);
}

/**
 * Get error message based on error type
 */
function getErrorMessage(error: UnauthorizedErrorContext): string {
  switch (error.type) {
    case UnauthorizedErrorType.UNAUTHENTICATED:
      return 'Authentication required';
    case UnauthorizedErrorType.UNAUTHORIZED:
      return 'Access denied';
    case UnauthorizedErrorType.NO_BRANCH:
      return 'Branch context required';
    case UnauthorizedErrorType.EXPIRED_SESSION:
      return 'Session expired';
    case UnauthorizedErrorType.INVALID_TOKEN:
      return 'Invalid authentication';
    default:
      return 'Access denied';
  }
}

/**
 * Get error description based on error type
 */
function getErrorDescription(error: UnauthorizedErrorContext): string {
  switch (error.type) {
    case UnauthorizedErrorType.UNAUTHENTICATED:
      return 'Please log in to access this resource';
    case UnauthorizedErrorType.UNAUTHORIZED:
      return error.requiredPermissions
        ? `Required permissions: ${error.requiredPermissions.join(', ')}`
        : 'You do not have permission to access this resource';
    case UnauthorizedErrorType.NO_BRANCH:
      return 'Your account is not associated with any branch';
    case UnauthorizedErrorType.EXPIRED_SESSION:
      return 'Your session has expired. Please log in again';
    case UnauthorizedErrorType.INVALID_TOKEN:
      return 'Your authentication token is invalid';
    default:
      return 'Please contact your administrator if you believe this is an error';
  }
}

/**
 * Create unauthorized error context
 */
export function createUnauthorizedError(
  type: UnauthorizedErrorType,
  context?: Partial<UnauthorizedErrorContext>
): UnauthorizedErrorContext {
  return {
    type,
    timestamp: new Date(),
    ...context,
  };
}

/**
 * Handle authentication failure
 */
export function handleAuthenticationFailure(attemptedPath?: string): void {
  handleUnauthorized(
    createUnauthorizedError(UnauthorizedErrorType.UNAUTHENTICATED, {
      attemptedPath,
    }),
    {
      redirectPath: '/login',
    }
  );
}

/**
 * Handle authorization failure
 */
export function handleAuthorizationFailure(
  requiredPermissions: string[],
  attemptedPath?: string
): void {
  handleUnauthorized(
    createUnauthorizedError(UnauthorizedErrorType.UNAUTHORIZED, {
      requiredPermissions,
      attemptedPath,
    }),
    {
      redirectPath: '/dashboard',
    }
  );
}

/**
 * Handle branch context failure
 */
export function handleBranchContextFailure(attemptedPath?: string): void {
  handleUnauthorized(
    createUnauthorizedError(UnauthorizedErrorType.NO_BRANCH, {
      attemptedPath,
    }),
    {
      redirectPath: '/dashboard',
    }
  );
}

/**
 * Handle session expiration
 */
export function handleSessionExpiration(attemptedPath?: string): void {
  handleUnauthorized(
    createUnauthorizedError(UnauthorizedErrorType.EXPIRED_SESSION, {
      attemptedPath,
    }),
    {
      redirectPath: '/login',
    }
  );
}

/**
 * Handle invalid token
 */
export function handleInvalidToken(attemptedPath?: string): void {
  handleUnauthorized(
    createUnauthorizedError(UnauthorizedErrorType.INVALID_TOKEN, {
      attemptedPath,
    }),
    {
      redirectPath: '/login',
    }
  );
}

/**
 * Global error boundary for unauthorized errors
 */
export class UnauthorizedError extends Error {
  type: UnauthorizedErrorType;
  context: UnauthorizedErrorContext;

  constructor(type: UnauthorizedErrorType, context?: Partial<UnauthorizedErrorContext>) {
    super(getErrorMessage(createUnauthorizedError(type, context)));
    this.name = 'UnauthorizedError';
    this.type = type;
    this.context = createUnauthorizedError(type, context);
  }
}

/**
 * Check if error is unauthorized error
 */
export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}

/**
 * Wrap async function with unauthorized handling
 */
export function withUnauthorizedHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: {
    onUnauthorized?: (error: UnauthorizedError) => void;
  }
) {
  return async function (...args: T): Promise<R> {
    try {
      return await fn(...args);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        options.onUnauthorized?.(error);
        throw error;
      }
      throw error;
    }
  };
}
