import { z } from 'zod';

/**
 * Common validation schemas
 * Reusable validation patterns across the application
 */

// String validations
export const stringSchema = z.string();
export const nonEmptyStringSchema = z.string().min(1, 'This field is required');
export const emailSchema = z.string().email('Invalid email address');
export const phoneSchema = z.string().regex(/^[+]?[\d\s-()]+$/, 'Invalid phone number');
export const urlSchema = z.string().url('Invalid URL');

// ID validations
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Date validations
export const dateSchema = z.string().or(z.date());
export const futureDateSchema = z.string().refine(
  (date) => new Date(date) > new Date(),
  'Date must be in the future'
);
export const pastDateSchema = z.string().refine(
  (date) => new Date(date) < new Date(),
  'Date must be in the past'
);

// Number validations
export const positiveNumberSchema = z.number().positive('Must be a positive number');
export const nonNegativeNumberSchema = z.number().nonnegative('Must be a non-negative number');
export const integerSchema = z.number().int('Must be an integer');

// Common field schemas
export const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must not exceed 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

export const codeSchema = z.string()
  .min(2, 'Code must be at least 2 characters')
  .max(50, 'Code must not exceed 50 characters')
  .regex(/^[A-Z0-9_-]+$/, 'Code can only contain uppercase letters, numbers, hyphens, and underscores');

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Common response schemas
export const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
});

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.any().optional(),
  }),
});

/**
 * Validation helper functions
 */

/**
 * Validate data against a schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validate data against a schema
 * Returns result object instead of throwing
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Format Zod error for user display
 */
export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((err) => {
      const path = err.path.join('.');
      const message = err.message;
      return path ? `${path}: ${message}` : message;
    })
    .join(', ');
}

/**
 * Create a paginated response validator
 */
export function createPaginatedResponseSchema<T>(itemSchema: z.ZodSchema<T>) {
  return z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      pageSize: z.number(),
      total: z.number(),
      totalPages: z.number(),
      hasNextPage: z.boolean(),
      hasPreviousPage: z.boolean(),
    }),
  });
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Sanitize phone number input
 */
export function sanitizePhone(input: string): string {
  return input.replace(/[^\d+]/g, '');
}
