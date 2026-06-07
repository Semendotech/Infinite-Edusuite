/**
 * Student domain types
 * Database entities, DTOs, and input/output types
 */

/**
 * Database entity (matches Supabase schema)
 */
export interface StudentEntity {
  id: string;
  user_id?: string | null;
  branch_id: string;
  registration_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  national_id?: string | null;
  address?: string | null;
  enrollment_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Student DTO (Data Transfer Object)
 * Used for API responses and internal service communication
 */
export interface StudentDTO {
  id: string;
  userId?: string;
  branchId: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  nationalId?: string;
  address?: string;
  enrollmentDate: string;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
  age?: number;
}

/**
 * Student status enum
 */
export enum StudentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  GRADUATED = 'graduated',
  SUSPENDED = 'suspended',
  WITHDRAWN = 'withdrawn',
}

/**
 * Create student input
 */
export interface CreateStudentInput {
  branchId: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  nationalId?: string;
  address?: string;
  status?: StudentStatus;
}

/**
 * Update student input
 */
export interface UpdateStudentInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  nationalId?: string;
  address?: string;
  status?: StudentStatus;
}

/**
 * Student query filters
 */
export interface StudentQueryFilters {
  branchId?: string;
  status?: StudentStatus;
  search?: string;
  registrationNumber?: string;
  userId?: string;
}

/**
 * Student list response with pagination
 */
export interface StudentListResponse {
  data: StudentDTO[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Student summary (for dropdowns, lists)
 */
export interface StudentSummary {
  id: string;
  fullName: string;
  registrationNumber: string;
  email: string;
  status: StudentStatus;
}

/**
 * Student profile with related data
 */
export interface StudentProfile extends StudentDTO {
  branch?: {
    id: string;
    name: string;
    code: string;
  };
  user?: {
    id: string;
    email: string;
    fullName: string;
  };
  enrollments?: StudentEnrollment[];
  fees?: StudentFeeSummary;
}

/**
 * Student enrollment
 */
export interface StudentEnrollment {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  enrolledAt: string;
  status: 'active' | 'completed' | 'dropped';
}

/**
 * Student fee summary
 */
export interface StudentFeeSummary {
  totalFees: number;
  paidAmount: number;
  balance: number;
  dueDate?: string;
  paymentStatus: 'paid' | 'partial' | 'overdue' | 'pending';
}

/**
 * Student statistics
 */
export interface StudentStatistics {
  totalStudents: number;
  activeStudents: number;
  newEnrollmentsThisMonth: number;
  studentsByStatus: Record<StudentStatus, number>;
  studentsByBranch: Record<string, number>;
}

/**
 * Student search result
 */
export interface StudentSearchResult {
  id: string;
  fullName: string;
  registrationNumber: string;
  email: string;
  branchName: string;
  status: StudentStatus;
  matchScore?: number;
}
