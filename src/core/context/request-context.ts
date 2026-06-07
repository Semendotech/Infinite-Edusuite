/**
 * Request Context Pattern
 * Provides a consistent way to pass request-scoped data through the service layer
 * Includes user identity, branch context, permissions, and metadata
 */

import { Permission, Role } from '../rbac/permissions';

/**
 * Request context interface
 */
export interface RequestContext {
  // User identity
  userId: string;
  
  // Branch context
  branchId?: string;
  branchIds?: string[];
  
  // Authorization
  roles?: Role[];
  permissions?: Permission[];
  isSuperAdmin?: boolean;
  
  // Request metadata
  requestId?: string;
  timestamp?: number;
  ipAddress?: string;
  userAgent?: string;
  
  // Feature flags
  skipAudit?: boolean;
  skipValidation?: boolean;
  
  // Custom metadata
  metadata?: Record<string, any>;
}

/**
 * Request context builder
 * Provides a fluent API for building request contexts
 */
export class RequestContextBuilder {
  private context: Partial<RequestContext> = {};

  withUserId(userId: string): this {
    this.context.userId = userId;
    return this;
  }

  withBranchId(branchId: string): this {
    this.context.branchId = branchId;
    return this;
  }

  withBranchIds(branchIds: string[]): this {
    this.context.branchIds = branchIds;
    return this;
  }

  withRoles(roles: Role[]): this {
    this.context.roles = roles;
    return this;
  }

  withPermissions(permissions: Permission[]): this {
    this.context.permissions = permissions;
    return this;
  }

  withSuperAdmin(isSuperAdmin: boolean): this {
    this.context.isSuperAdmin = isSuperAdmin;
    return this;
  }

  withRequestId(requestId: string): this {
    this.context.requestId = requestId;
    return this;
  }

  withTimestamp(timestamp: number): this {
    this.context.timestamp = timestamp;
    return this;
  }

  withIpAddress(ipAddress: string): this {
    this.context.ipAddress = ipAddress;
    return this;
  }

  withUserAgent(userAgent: string): this {
    this.context.userAgent = userAgent;
    return this;
  }

  withSkipAudit(skip: boolean): this {
    this.context.skipAudit = skip;
    return this;
  }

  withSkipValidation(skip: boolean): this {
    this.context.skipValidation = skip;
    return this;
  }

  withMetadata(metadata: Record<string, any>): this {
    this.context.metadata = metadata;
    return this;
  }

  build(): RequestContext {
    if (!this.context.userId) {
      throw new Error('RequestContext must have a userId');
    }

    return {
      userId: this.context.userId,
      branchId: this.context.branchId,
      branchIds: this.context.branchIds,
      roles: this.context.roles || [],
      permissions: this.context.permissions || [],
      isSuperAdmin: this.context.isSuperAdmin || false,
      requestId: this.context.requestId || generateRequestId(),
      timestamp: this.context.timestamp || Date.now(),
      ipAddress: this.context.ipAddress,
      userAgent: this.context.userAgent,
      skipAudit: this.context.skipAudit || false,
      skipValidation: this.context.skipValidation || false,
      metadata: this.context.metadata || {},
    };
  }
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a minimal request context
 */
export function createRequestContext(userId: string, branchId?: string): RequestContext {
  return new RequestContextBuilder()
    .withUserId(userId)
    .withBranchId(branchId)
    .build();
}

/**
 * Extract request context from TanStack router context
 */
export function extractRequestContext(routerContext: any): RequestContext {
  const auth = routerContext.auth;
  const branchIsolation = routerContext.branchIsolation;
  
  const userId = auth.user?.id;
  if (!userId) {
    throw new Error('Cannot extract request context: user not authenticated');
  }
  
  return new RequestContextBuilder()
    .withUserId(userId)
    .withBranchId(branchIsolation?.branchId || undefined)
    .withBranchIds(auth.user?.branchIds || [])
    .withRoles(auth.user?.roles || [])
    .withPermissions(auth.user?.permissions || [])
    .withSuperAdmin(auth.user?.roles?.includes('super_admin') || false)
    .build();
}

/**
 * Validate request context
 */
export function validateRequestContext(context: RequestContext): void {
  if (!context.userId) {
    throw new Error('RequestContext must have a userId');
  }

  if (context.branchId && context.branchIds && !context.branchIds.includes(context.branchId)) {
    throw new Error('BranchId must be in branchIds');
  }
}

/**
 * Check if context has permission
 */
export function contextHasPermission(context: RequestContext, permission: Permission): boolean {
  return context.permissions?.includes(permission) || context.isSuperAdmin || false;
}

/**
 * Check if context has role
 */
export function contextHasRole(context: RequestContext, role: Role): boolean {
  return context.roles?.includes(role) || context.isSuperAdmin || false;
}

/**
 * Check if context has any of the permissions
 */
export function contextHasAnyPermission(context: RequestContext, permissions: Permission[]): boolean {
  return permissions.some(p => contextHasPermission(context, p));
}

/**
 * Check if context has all of the permissions
 */
export function contextHasAllPermissions(context: RequestContext, permissions: Permission[]): boolean {
  return permissions.every(p => contextHasPermission(context, p));
}

/**
 * Get effective branch ID from context
 * Returns the branchId if set, or the first branchId from branchIds
 */
export function getEffectiveBranchId(context: RequestContext): string | undefined {
  return context.branchId || context.branchIds?.[0];
}
