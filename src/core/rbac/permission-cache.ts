import { Permission, Role } from './permissions';

/**
 * Permission cache entry
 */
interface CacheEntry {
  permissions: Permission[];
  roles: Role[];
  timestamp: number;
  ttl: number;
}

/**
 * Permission Cache
 * In-memory cache for user permissions and roles
 * Reduces database queries for permission checks
 */
export class PermissionCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes default

  constructor(ttl?: number) {
    if (ttl) {
      this.defaultTTL = ttl;
    }
  }

  /**
   * Generate cache key for user
   */
  private generateKey(userId: string): string {
    return `user:${userId}`;
  }

  /**
   * Get cached permissions for user
   */
  get(userId: string): CacheEntry | null {
    const key = this.generateKey(userId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Set cached permissions for user
   */
  set(userId: string, permissions: Permission[], roles: Role[], ttl?: number): void {
    const key = this.generateKey(userId);
    const entry: CacheEntry = {
      permissions,
      roles,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if user has permission (using cache)
   */
  hasPermission(userId: string, permission: Permission): boolean {
    const entry = this.get(userId);
    if (!entry) {
      return false;
    }
    return entry.permissions.includes(permission);
  }

  /**
   * Check if user has role (using cache)
   */
  hasRole(userId: string, role: Role): boolean {
    const entry = this.get(userId);
    if (!entry) {
      return false;
    }
    return entry.roles.includes(role);
  }

  /**
   * Get all permissions for user (from cache)
   */
  getPermissions(userId: string): Permission[] {
    const entry = this.get(userId);
    return entry?.permissions || [];
  }

  /**
   * Get all roles for user (from cache)
   */
  getRoles(userId: string): Role[] {
    const entry = this.get(userId);
    return entry?.roles || [];
  }

  /**
   * Invalidate cache for specific user
   */
  invalidate(userId: string): void {
    const key = this.generateKey(userId);
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{ userId: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      userId: key.replace('user:', ''),
      age: now - entry.timestamp,
      ttl: entry.ttl,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }
}

// Singleton instance
export const permissionCache = new PermissionCache();

// Auto-cleanup expired entries every 5 minutes
if (typeof window === 'undefined') {
  // Only run on server-side
  setInterval(() => {
    permissionCache.cleanup();
  }, 5 * 60 * 1000);
}
