import { BaseService, ServiceOptions } from '../base.service';
import { studentRepository } from '@/repositories/student.repository';
import { 
  StudentDTO, 
  StudentEntity, 
  CreateStudentInput, 
  UpdateStudentInput, 
  StudentQueryFilters, 
  StudentListResponse,
  StudentStatistics,
  StudentStatus 
} from '@/types/student.types';
import { Permission, Role } from '@/core/rbac/permissions';
import { RequestContext } from '@/core/context/request-context';
import { emit } from '@/core/events/event-system';
import { 
  validateCreateStudent, 
  validateUpdateStudent, 
  validateStudentQuery,
  safeValidateCreateStudent,
  safeValidateUpdateStudent 
} from '@/validators/student.validators';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '@/lib/error-handler';

/**
 * Student Service
 * Complete service layer implementation demonstrating:
 * - RBAC integration
 * - Branch isolation
 * - Audit logging
 * - Event emission
 * - DTO transformation
 * - Request context usage
 */
export class StudentService extends BaseService {
  private repository = studentRepository;

  /**
   * Transform database entity to DTO
   */
  private entityToDTO(entity: StudentEntity): StudentDTO {
    const dateOfBirth = entity.date_of_birth ? new Date(entity.date_of_birth) : undefined;
    const enrollmentDate = new Date(entity.enrollment_date);
    const createdAt = new Date(entity.created_at);
    const updatedAt = new Date(entity.updated_at);

    // Calculate age if date of birth is available
    let age: number | undefined;
    if (dateOfBirth) {
      const today = new Date();
      age = today.getFullYear() - dateOfBirth.getFullYear();
      const monthDiff = today.getMonth() - dateOfBirth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
        age--;
      }
    }

    return {
      id: entity.id,
      userId: entity.user_id || undefined,
      branchId: entity.branch_id,
      registrationNumber: entity.registration_number,
      firstName: entity.first_name,
      lastName: entity.last_name,
      fullName: `${entity.first_name} ${entity.last_name}`,
      email: entity.email,
      phone: entity.phone || undefined,
      dateOfBirth: entity.date_of_birth || undefined,
      gender: entity.gender || undefined,
      nationalId: entity.national_id || undefined,
      address: entity.address || undefined,
      enrollmentDate: entity.enrollment_date,
      status: entity.status as StudentStatus,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
      age,
    };
  }

  /**
   * Transform DTO to database entity
   */
  private dtoToEntity(dto: CreateStudentInput | UpdateStudentInput): Partial<StudentEntity> {
    const entity: Partial<StudentEntity> = {};

    if ('branchId' in dto && dto.branchId) entity.branch_id = dto.branchId;
    if ('registrationNumber' in dto && dto.registrationNumber) entity.registration_number = dto.registrationNumber;
    if ('firstName' in dto && dto.firstName) entity.first_name = dto.firstName;
    if ('lastName' in dto && dto.lastName) entity.last_name = dto.lastName;
    if ('email' in dto && dto.email) entity.email = dto.email;
    if ('phone' in dto && dto.phone !== undefined) entity.phone = dto.phone || null;
    if ('dateOfBirth' in dto && dto.dateOfBirth !== undefined) entity.date_of_birth = dto.dateOfBirth || null;
    if ('gender' in dto && dto.gender !== undefined) entity.gender = dto.gender || null;
    if ('nationalId' in dto && dto.nationalId !== undefined) entity.national_id = dto.nationalId || null;
    if ('address' in dto && dto.address !== undefined) entity.address = dto.address || null;
    if ('status' in dto && dto.status !== undefined) entity.status = dto.status;

    return entity;
  }

  /**
   * Get student by ID
   */
  async getStudent(studentId: string, context: RequestContext): Promise<StudentDTO> {
    // Permission check
    this.requirePermission(context, Permission.STUDENT_VIEW);

    // Branch isolation check
    const entity = await this.repository.findById(studentId);
    if (!entity) {
      throw new NotFoundError('Student');
    }

    // Validate branch access
    if (!this.validateBranchAccess(context, entity.branch_id)) {
      throw new ForbiddenError('You do not have access to this student');
    }

    // Transform to DTO
    return this.entityToDTO(entity);
  }

  /**
   * Get student by registration number
   */
  async getStudentByRegistrationNumber(registrationNumber: string, context: RequestContext): Promise<StudentDTO> {
    // Permission check
    this.requirePermission(context, Permission.STUDENT_VIEW);

    const entity = await this.repository.findByRegistrationNumber(registrationNumber);
    if (!entity) {
      throw new NotFoundError('Student');
    }

    // Validate branch access
    if (!this.validateBranchAccess(context, entity.branch_id)) {
      throw new ForbiddenError('You do not have access to this student');
    }

    return this.entityToDTO(entity);
  }

  /**
   * Get students by branch
   */
  async getStudentsByBranch(branchId: string, context: RequestContext): Promise<StudentDTO[]> {
    // Permission check
    this.requirePermission(context, Permission.STUDENT_VIEW);

    // Validate branch access
    if (!this.validateBranchAccess(context, branchId)) {
      throw new ForbiddenError('You do not have access to this branch');
    }

    const entities = await this.repository.findByBranch(branchId);
    return entities.map(entity => this.entityToDTO(entity));
  }

  /**
   * Query students with filters and pagination
   */
  async queryStudents(filters: StudentQueryFilters, context: RequestContext): Promise<StudentListResponse> {
    // Permission check
    this.requirePermission(context, Permission.STUDENT_VIEW);

    // Validate filters
    const validatedFilters = validateStudentQuery(filters);

    // Apply branch isolation if not super admin
    if (!context.isSuperAdmin && !validatedFilters.branchId) {
      validatedFilters.branchId = context.branchId;
    }

    // Validate branch access
    if (validatedFilters.branchId && !this.validateBranchAccess(context, validatedFilters.branchId)) {
      throw new ForbiddenError('You do not have access to this branch');
    }

    const result = await this.repository.findPaginatedWithFilters(
      {
        branchId: validatedFilters.branchId,
        status: validatedFilters.status,
        search: validatedFilters.search,
      },
      validatedFilters.page || 1,
      validatedFilters.pageSize || 20
    );

    return {
      data: result.data.map(entity => this.entityToDTO(entity)),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.count,
        totalPages: result.totalPages,
        hasNextPage: result.page * result.pageSize < result.count,
        hasPreviousPage: result.page > 1,
      },
    };
  }

  /**
   * Create new student
   */
  async createStudent(input: CreateStudentInput, context: RequestContext): Promise<StudentDTO> {
    // Permission check
    this.requirePermission(context, Permission.STUDENT_CREATE);

    // Validate input
    const validatedInput = validateCreateStudent(input);

    // Validate branch access
    if (!this.validateBranchAccess(context, validatedInput.branchId)) {
      throw new ForbiddenError('You do not have access to this branch');
    }

    // Check for duplicate registration number
    const regNumberExists = await this.repository.registrationNumberExists(validatedInput.registrationNumber);
    if (regNumberExists) {
      throw new ConflictError('A student with this registration number already exists');
    }

    // Check for duplicate email
    const emailExists = await this.repository.emailExists(validatedInput.email);
    if (emailExists) {
      throw new ConflictError('A student with this email already exists');
    }

    // Transform to entity
    const entity = this.dtoToEntity(validatedInput);

    // Execute with audit logging
    const result = await this.execute(
      async () => {
        return this.repository.create(entity as any);
      },
      { context }
    );

    // Emit event
    await emit('student:created', {
      studentId: result.id,
      userId: context.userId,
      branchId: result.branch_id,
    });

    return this.entityToDTO(result);
  }

  /**
   * Update student
   */
  async updateStudent(studentId: string, input: UpdateStudentInput, context: RequestContext): Promise<StudentDTO> {
    // Permission check
    this.requirePermission(context, Permission.STUDENT_UPDATE);

    // Validate input
    const validatedInput = validateUpdateStudent(input);

    // Get existing student
    const existing = await this.repository.findById(studentId);
    if (!existing) {
      throw new NotFoundError('Student');
    }

    // Validate branch access
    if (!this.validateBranchAccess(context, existing.branch_id)) {
      throw new ForbiddenError('You do not have access to this student');
    }

    // Check for duplicate email if changing
    if (validatedInput.email && validatedInput.email !== existing.email) {
      const emailExists = await this.repository.emailExists(validatedInput.email, studentId);
      if (emailExists) {
        throw new ConflictError('A student with this email already exists');
      }
    }

    // Transform to entity
    const entity = this.dtoToEntity(validatedInput);

    // Execute with audit logging
    const result = await this.execute(
      async () => {
        return this.repository.update(studentId, entity as any);
      },
      { context }
    );

    // Emit event
    await emit('student:updated', {
      studentId: result.id,
      userId: context.userId,
      changes: validatedInput,
    });

    return this.entityToDTO(result);
  }

  /**
   * Delete student (soft delete)
   */
  async deleteStudent(studentId: string, context: RequestContext): Promise<void> {
    // Permission check
    this.requirePermission(context, Permission.STUDENT_DELETE);

    // Get existing student
    const existing = await this.repository.findById(studentId);
    if (!existing) {
      throw new NotFoundError('Student');
    }

    // Validate branch access
    if (!this.validateBranchAccess(context, existing.branch_id)) {
      throw new ForbiddenError('You do not have access to this student');
    }

    // Execute with audit logging
    await this.execute(
      async () => {
        await this.repository.softDelete(studentId);
      },
      { context }
    );

    // Emit event
    await emit('student:deleted', {
      studentId,
      userId: context.userId,
    });
  }

  /**
   * Search students
   */
  async searchStudents(query: string, context: RequestContext): Promise<StudentDTO[]> {
    // Permission check
    this.requirePermission(context, Permission.STUDENT_VIEW);

    // Apply branch isolation
    const branchId = context.isSuperAdmin ? undefined : context.branchId;

    const entities = await this.repository.search(query, branchId);
    return entities.map(entity => this.entityToDTO(entity));
  }

  /**
   * Get student statistics
   */
  async getStatistics(context: RequestContext): Promise<StudentStatistics> {
    // Permission check
    this.requirePermission(context, Permission.STUDENT_VIEW);

    const branchId = context.isSuperAdmin ? undefined : context.branchId;

    if (!branchId) {
      throw new Error('Branch ID is required for statistics');
    }

    const stats = await this.repository.getStatisticsByBranch(branchId);

    return {
      totalStudents: stats.total,
      activeStudents: stats.byStatus['active'] || 0,
      newEnrollmentsThisMonth: 0, // TODO: Implement monthly enrollment tracking
      studentsByStatus: stats.byStatus as Record<StudentStatus, number>,
      studentsByBranch: {
        [branchId]: stats.total,
      },
    };
  }

  /**
   * Link student to user account
   */
  async linkToUser(studentId: string, userId: string, context: RequestContext): Promise<void> {
    // Permission check
    this.requirePermission(context, Permission.USER_UPDATE);

    // Get existing student
    const existing = await this.repository.findById(studentId);
    if (!existing) {
      throw new NotFoundError('Student');
    }

    // Validate branch access
    if (!this.validateBranchAccess(context, existing.branch_id)) {
      throw new ForbiddenError('You do not have access to this student');
    }

    await this.execute(
      async () => {
        await this.repository.linkToUser(studentId, userId);
      },
      { context }
    );
  }

  /**
   * Unlink student from user account
   */
  async unlinkFromUser(studentId: string, context: RequestContext): Promise<void> {
    // Permission check
    this.requirePermission(context, Permission.USER_UPDATE);

    // Get existing student
    const existing = await this.repository.findById(studentId);
    if (!existing) {
      throw new NotFoundError('Student');
    }

    // Validate branch access
    if (!this.validateBranchAccess(context, existing.branch_id)) {
      throw new ForbiddenError('You do not have access to this student');
    }

    await this.execute(
      async () => {
        await this.repository.unlinkFromUser(studentId);
      },
      { context }
    );
  }

  /**
   * Claim a student profile by matching registration number and email.
   */
  async claimStudentProfileByRegistration(
    registrationNumber: string,
    userEmail: string,
    userId: string,
    context: RequestContext
  ): Promise<void> {
    const normalizedRegistration = registrationNumber.trim();
    if (!normalizedRegistration) {
      throw new ValidationError('Registration number is required.');
    }

    const student = await this.repository.findByRegistrationNumber(normalizedRegistration);
    if (!student) {
      throw new NotFoundError('Student');
    }

    if (student.user_id && student.user_id !== userId) {
      throw new ConflictError('This student profile is already linked to another account.');
    }

    if (student.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenError('Your account email does not match the student record email.');
    }

    await this.execute(
      async () => {
        await this.repository.linkToUser(student.id, userId);
      },
      { context }
    );
  }
}

// Singleton instance
export const studentService = new StudentService();
