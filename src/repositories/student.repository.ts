import { BaseRepository } from './base.repository';
import { StudentEntity } from '@/types/student.types';

/**
 * Student Repository
 * Data access layer for student operations
 */
export class StudentRepository extends BaseRepository<StudentEntity> {
  constructor() {
    super('students');
  }

  /**
   * Find student by registration number
   */
  async findByRegistrationNumber(registrationNumber: string): Promise<StudentEntity | null> {
    const { data, error } = await this.supabase
      .from('students')
      .select('*')
      .eq('registration_number', registrationNumber)
      .maybeSingle();
    
    if (error) {
      this.handleError(error, 'findByRegistrationNumber');
      throw error;
    }
    
    return data;
  }

  /**
   * Find students by branch
   */
  async findByBranch(branchId: string): Promise<StudentEntity[]> {
    const { data, error } = await this.supabase
      .from('students')
      .select('*')
      .eq('branch_id', branchId)
      .is('deleted_at', null);
    
    if (error) {
      this.handleError(error, 'findByBranch');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Find student by user ID
   */
  async findByUserId(userId: string): Promise<StudentEntity | null> {
    const { data, error } = await this.supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      this.handleError(error, 'findByUserId');
      throw error;
    }
    
    return data;
  }

  /**
   * Find students by status
   */
  async findByStatus(status: string, branchId?: string): Promise<StudentEntity[]> {
    let query = this.supabase
      .from('students')
      .select('*')
      .eq('status', status)
      .is('deleted_at', null);
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      this.handleError(error, 'findByStatus');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Search students by name, email, or registration number
   */
  async search(query: string, branchId?: string, limit: number = 20): Promise<StudentEntity[]> {
    let supabaseQuery = this.supabase
      .from('students')
      .select('*')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,registration_number.ilike.%${query}%`)
      .is('deleted_at', null)
      .limit(limit);
    
    if (branchId) {
      supabaseQuery = supabaseQuery.eq('branch_id', branchId);
    }
    
    const { data, error } = await supabaseQuery;
    
    if (error) {
      this.handleError(error, 'search');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Get student count by branch
   */
  async countByBranch(branchId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .is('deleted_at', null);
    
    if (error) {
      this.handleError(error, 'countByBranch');
      throw error;
    }
    
    return count || 0;
  }

  /**
   * Get student count by status
   */
  async countByStatus(status: string, branchId?: string): Promise<number> {
    let query = this.supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)
      .is('deleted_at', null);
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    
    const { count, error } = await query;
    
    if (error) {
      this.handleError(error, 'countByStatus');
      throw error;
    }
    
    return count || 0;
  }

  /**
   * Get students with pagination and filters
   */
  async findPaginatedWithFilters(
    filters: {
      branchId?: string;
      status?: string;
      search?: string;
    } = {},
    page: number = 1,
    pageSize: number = 20
  ) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from('students')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,registration_number.ilike.%${filters.search}%`
      );
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      this.handleError(error, 'findPaginatedWithFilters');
      throw error;
    }

    return {
      data: data || [],
      count: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * Check if registration number exists
   */
  async registrationNumberExists(registrationNumber: string, excludeId?: string): Promise<boolean> {
    let query = this.supabase
      .from('students')
      .select('id')
      .eq('registration_number', registrationNumber);
    
    if (excludeId) {
      query = query.not('id', 'eq', excludeId);
    }
    
    const { data } = await query.maybeSingle();
    return !!data;
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    let query = this.supabase
      .from('students')
      .select('id')
      .eq('email', email);
    
    if (excludeId) {
      query = query.not('id', 'eq', excludeId);
    }
    
    const { data } = await query.maybeSingle();
    return !!data;
  }

  /**
   * Get student statistics by branch
   */
  async getStatisticsByBranch(branchId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
  }> {
    const { data, error } = await this.supabase
      .from('students')
      .select('status')
      .eq('branch_id', branchId)
      .is('deleted_at', null);
    
    if (error) {
      this.handleError(error, 'getStatisticsByBranch');
      throw error;
    }

    const students = data || [];
    const byStatus: Record<string, number> = {};

    students.forEach(student => {
      byStatus[student.status] = (byStatus[student.status] || 0) + 1;
    });

    return {
      total: students.length,
      byStatus,
    };
  }

  /**
   * Link student to user account
   */
  async linkToUser(studentId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('students')
      .update({ user_id: userId })
      .eq('id', studentId);
    
    if (error) {
      this.handleError(error, 'linkToUser');
      throw error;
    }
  }

  /**
   * Unlink student from user account
   */
  async unlinkFromUser(studentId: string): Promise<void> {
    const { error } = await this.supabase
      .from('students')
      .update({ user_id: null })
      .eq('id', studentId);
    
    if (error) {
      this.handleError(error, 'unlinkFromUser');
      throw error;
    }
  }
}

// Singleton instance
export const studentRepository = new StudentRepository();
