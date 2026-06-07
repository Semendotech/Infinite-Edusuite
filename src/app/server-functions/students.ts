/**
 * Student Server Functions
 * Demonstrates the complete architectural flow:
 * Route → Server Function → Service → Repository → Database
 * 
 * These functions can be called from client components using TanStack Start's server functions
 */

import { createServerFn } from '@tanstack/react-start';
import { studentService } from '@/services/students/student.service';
import { RequestContextBuilder } from '@/core/context/request-context';
import { extractRequestContext } from '@/core/context/request-context';
import { rbacService } from '@/core/rbac/rbac.service';
import { permissionCache } from '@/core/rbac/permission-cache';
import { serverAuthGuard } from '@/core/auth/serverAuthGuard';
import { Permission, Role } from '@/core/rbac/permissions';
import { 
  CreateStudentInput, 
  UpdateStudentInput, 
  StudentQueryFilters,
  StudentDTO 
} from '@/types/student.types';
import { toAppError, formatErrorResponse } from '@/lib/error-handler';

/**
 * Get student by ID
 * Server function that demonstrates:
 * - Request context extraction
 * - RBAC permission check
 * - Service layer call
 * - Error handling
 */
export const getStudent = createServerFn({ method: 'GET' })
  .validator((input: { studentId: string }) => input)
  .handler(async ({ data, request }) => {
    try {
      // Extract user info from request (this would come from auth middleware)
      // For now, we'll simulate getting it from the request
      const userId = request.headers.get('x-user-id') || 'demo-user-id';
      
      // Build request context with permissions from cache
      const roles = await rbacService.getUserRoles(userId);
      const permissions = await rbacService.getUserPermissions(userId);
      
      const context = new RequestContextBuilder()
        .withUserId(userId)
        .withRoles(roles)
        .withPermissions(permissions)
        .withSuperAdmin(roles.includes(Role.SUPER_ADMIN))
        .withIpAddress(request.headers.get('x-forwarded-for') || undefined)
        .withUserAgent(request.headers.get('user-agent') || undefined)
        .build();
      
      // Call service layer
      const student = await studentService.getStudent(data.studentId, context);
      
      return {
        success: true,
        data: student,
      };
    } catch (error) {
      return formatErrorResponse(error);
    }
  });

/**
 * Query students with filters and pagination
 * Server function demonstrating:
 * - Query validation
 * - Branch isolation
 * - Permission checking
 */
export const queryStudents = createServerFn({ method: 'GET' })
  .validator((input: StudentQueryFilters) => input)
  .handler(async ({ data, request }) => {
    try {
      const userId = request.headers.get('x-user-id') || 'demo-user-id';
      
      // Get permissions from cache
      let roles = permissionCache.getRoles(userId);
      let permissions = permissionCache.getPermissions(userId);
      
      // Cache miss - fetch from database
      if (!roles || roles.length === 0) {
        roles = await rbacService.getUserRoles(userId);
        permissions = await rbacService.getUserPermissions(userId);
        permissionCache.set(userId, permissions, roles);
      }
      
      const context = new RequestContextBuilder()
        .withUserId(userId)
        .withRoles(roles)
        .withPermissions(permissions)
        .withSuperAdmin(roles.includes(Role.SUPER_ADMIN))
        .build();
      
      // Call service layer
      const result = await studentService.queryStudents(data, context);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return formatErrorResponse(error);
    }
  });

/**
 * Create new student
 * Server function demonstrating:
 * - Input validation
 * - Permission checking
 * - Event emission (automatic via service)
 * - Audit logging (automatic via service)
 */
export const createStudent = createServerFn({ method: 'POST' })
  .validator((input: CreateStudentInput) => input)
  .handler(async ({ data, request }) => {
    try {
      const userId = request.headers.get('x-user-id') || 'demo-user-id';
      
      const roles = await rbacService.getUserRoles(userId);
      const permissions = await rbacService.getUserPermissions(userId);
      
      const context = new RequestContextBuilder()
        .withUserId(userId)
        .withRoles(roles)
        .withPermissions(permissions)
        .withSuperAdmin(roles.includes(Role.SUPER_ADMIN))
        .withIpAddress(request.headers.get('x-forwarded-for') || undefined)
        .build();
      
      // Call service layer
      const student = await studentService.createStudent(data, context);
      
      return {
        success: true,
        data: student,
      };
    } catch (error) {
      return formatErrorResponse(error);
    }
  });

/**
 * Update student
 * Server function demonstrating:
 * - Permission checking
 * - Branch access validation
 * - Change tracking (via events)
 */
export const updateStudent = createServerFn({ method: 'PUT' })
  .validator((input: { studentId: string; updates: UpdateStudentInput }) => input)
  .handler(async ({ data, request }) => {
    try {
      const userId = request.headers.get('x-user-id') || 'demo-user-id';
      
      const roles = await rbacService.getUserRoles(userId);
      const permissions = await rbacService.getUserPermissions(userId);
      
      const context = new RequestContextBuilder()
        .withUserId(userId)
        .withRoles(roles)
        .withPermissions(permissions)
        .withSuperAdmin(roles.includes(Role.SUPER_ADMIN))
        .build();
      
      // Call service layer
      const student = await studentService.updateStudent(data.studentId, data.updates, context);
      
      return {
        success: true,
        data: student,
      };
    } catch (error) {
      return formatErrorResponse(error);
    }
  });

/**
 * Delete student
 * Server function demonstrating:
 * - Permission checking
 * - Soft delete (via repository)
 * - Audit logging
 */
export const deleteStudent = createServerFn({ method: 'DELETE' })
  .validator((input: { studentId: string }) => input)
  .handler(async ({ data, request }) => {
    try {
      const userId = request.headers.get('x-user-id') || 'demo-user-id';
      
      const roles = await rbacService.getUserRoles(userId);
      const permissions = await rbacService.getUserPermissions(userId);
      
      const context = new RequestContextBuilder()
        .withUserId(userId)
        .withRoles(roles)
        .withPermissions(permissions)
        .withSuperAdmin(roles.includes(Role.SUPER_ADMIN))
        .build();
      
      // Call service layer
      await studentService.deleteStudent(data.studentId, context);
      
      return {
        success: true,
        data: null,
      };
    } catch (error) {
      return formatErrorResponse(error);
    }
  });

/**
 * Search students
 * Server function demonstrating:
 * - Search functionality
 * - Branch isolation
 * - Permission checking
 */
export const searchStudents = createServerFn({ method: 'GET' })
  .validator((input: { query: string }) => input)
  .handler(async ({ data, request }) => {
    try {
      const userId = request.headers.get('x-user-id') || 'demo-user-id';
      
      const roles = await rbacService.getUserRoles(userId);
      const permissions = await rbacService.getUserPermissions(userId);
      
      const context = new RequestContextBuilder()
        .withUserId(userId)
        .withRoles(roles)
        .withPermissions(permissions)
        .withSuperAdmin(roles.includes(Role.SUPER_ADMIN))
        .build();
      
      // Call service layer
      const students = await studentService.searchStudents(data.query, context);
      
      return {
        success: true,
        data: students,
      };
    } catch (error) {
      return formatErrorResponse(error);
    }
  });

export const claimStudentProfile = createServerFn({ method: 'POST' })
  .validator((input: { registrationNumber: string }) => input)
  .handler(async ({ data, request }) => {
    try {
      const authResult = await serverAuthGuard({}, request);
      if (!authResult.success) {
        return formatErrorResponse(new Error(authResult.error?.message || 'Unauthorized'));
      }

      const authHeader = request.headers.get('authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      if (!token) {
        return formatErrorResponse(new Error('Missing authorization token'));
      }

      const { supabase } = await import('@/integrations/supabase/client');
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(token);

      if (userError || !user) {
        return formatErrorResponse(new Error('Unable to verify user session'));
      }

      const context = new RequestContextBuilder()
        .withUserId(authResult.userId)
        .withRoles(authResult.roles || [])
        .withPermissions(authResult.permissions || [])
        .withBranchIds(authResult.branchIds || [])
        .withSuperAdmin(authResult.roles?.includes(Role.SUPER_ADMIN) || false)
        .build();

      await studentService.claimStudentProfileByRegistration(
        data.registrationNumber,
        user.email || '',
        authResult.userId,
        context
      );

      return {
        success: true,
        data: null,
      };
    } catch (error) {
      return formatErrorResponse(error);
    }
  });

/**
 * Get student statistics
 * Server function demonstrating:
 * - Aggregation queries
 * - Branch-specific data
 * - Permission checking
 */
export const getStudentStatistics = createServerFn({ method: 'GET' })
  .handler(async ({ request }) => {
    try {
      const userId = request.headers.get('x-user-id') || 'demo-user-id';
      
      const roles = await rbacService.getUserRoles(userId);
      const permissions = await rbacService.getUserPermissions(userId);
      
      const context = new RequestContextBuilder()
        .withUserId(userId)
        .withRoles(roles)
        .withPermissions(permissions)
        .withSuperAdmin(roles.includes(Role.SUPER_ADMIN))
        .build();
      
      // Call service layer
      const stats = await studentService.getStatistics(context);
      
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return formatErrorResponse(error);
    }
  });
