import { z } from 'zod';
import { StudentStatus } from '@/types/student.types';

/**
 * Student validation schemas using Zod
 */

/**
 * Create student input schema
 */
export const createStudentSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  registrationNumber: z.string()
    .min(3, 'Registration number must be at least 3 characters')
    .max(50, 'Registration number must not exceed 50 characters')
    .regex(/^[A-Z0-9-]+$/, 'Registration number can only contain uppercase letters, numbers, and hyphens'),
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name must not exceed 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name must not exceed 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters'),
  phone: z.string()
    .regex(/^[+]?[\d\s-()]+$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),
  dateOfBirth: z.string()
    .refine((date) => {
      const d = new Date(date);
      const now = new Date();
      const minAge = 10;
      const maxAge = 100;
      const age = now.getFullYear() - d.getFullYear();
      return age >= minAge && age <= maxAge;
    }, 'Date of birth must be between 10 and 100 years ago')
    .optional()
    .or(z.literal('')),
  gender: z.enum(['male', 'female', 'other'], {
    errorMap: () => ({ message: 'Gender must be male, female, or other' }),
  })
    .optional()
    .or(z.literal('')),
  nationalId: z.string()
    .min(8, 'National ID must be at least 8 characters')
    .max(20, 'National ID must not exceed 20 characters')
    .optional()
    .or(z.literal('')),
  address: z.string()
    .max(500, 'Address must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
  status: z.nativeEnum(StudentStatus).optional(),
});

/**
 * Update student input schema
 */
export const updateStudentSchema = z.object({
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name must not exceed 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes')
    .optional(),
  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name must not exceed 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes')
    .optional(),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters')
    .optional(),
  phone: z.string()
    .regex(/^[+]?[\d\s-()]+$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),
  dateOfBirth: z.string()
    .refine((date) => {
      const d = new Date(date);
      const now = new Date();
      const minAge = 10;
      const maxAge = 100;
      const age = now.getFullYear() - d.getFullYear();
      return age >= minAge && age <= maxAge;
    }, 'Date of birth must be between 10 and 100 years ago')
    .optional()
    .or(z.literal('')),
  gender: z.enum(['male', 'female', 'other'], {
    errorMap: () => ({ message: 'Gender must be male, female, or other' }),
  })
    .optional()
    .or(z.literal('')),
  nationalId: z.string()
    .min(8, 'National ID must be at least 8 characters')
    .max(20, 'National ID must not exceed 20 characters')
    .optional()
    .or(z.literal('')),
  address: z.string()
    .max(500, 'Address must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
  status: z.nativeEnum(StudentStatus).optional(),
});

/**
 * Student query filters schema
 */
export const studentQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  search: z.string().min(2).max(100).optional(),
  registrationNumber: z.string().optional(),
  userId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * Student ID schema
 */
export const studentIdSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
});

/**
 * Batch student operations schema
 */
export const batchStudentUpdateSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'At least one student ID required'),
  updates: updateStudentSchema.partial(),
});

/**
 * Student enrollment schema
 */
export const studentEnrollmentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  courseId: z.string().uuid('Invalid course ID'),
  enrollmentDate: z.string().optional(),
});

/**
 * Type exports
 */
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentQueryFilters = z.infer<typeof studentQuerySchema>;
export type StudentIdInput = z.infer<typeof studentIdSchema>;
export type BatchStudentUpdateInput = z.infer<typeof batchStudentUpdateSchema>;
export type StudentEnrollmentInput = z.infer<typeof studentEnrollmentSchema>;

/**
 * Validation helper functions
 */

/**
 * Validate create student input
 */
export function validateCreateStudent(input: unknown): CreateStudentInput {
  return createStudentSchema.parse(input);
}

/**
 * Validate update student input
 */
export function validateUpdateStudent(input: unknown): UpdateStudentInput {
  return updateStudentSchema.parse(input);
}

/**
 * Validate student query filters
 */
export function validateStudentQuery(input: unknown): StudentQueryFilters {
  return studentQuerySchema.parse(input);
}

/**
 * Validate student ID
 */
export function validateStudentId(input: unknown): StudentIdInput {
  return studentIdSchema.parse(input);
}

/**
 * Safe validation functions (return result object)
 */

/**
 * Safely validate create student input
 */
export function safeValidateCreateStudent(input: unknown) {
  return createStudentSchema.safeParse(input);
}

/**
 * Safely validate update student input
 */
export function safeValidateUpdateStudent(input: unknown) {
  return updateStudentSchema.safeParse(input);
}

/**
 * Safely validate student query filters
 */
export function safeValidateStudentQuery(input: unknown) {
  return studentQuerySchema.safeParse(input);
}
