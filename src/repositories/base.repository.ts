import { supabase } from '@/integrations/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Base Repository Class
 * Provides common CRUD operations with Supabase
 * All repositories should extend this class
 */
export class BaseRepository<T> {
  protected supabase = supabase;
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Find by ID
   */
  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      this.handleError(error, 'findById');
      throw error;
    }
    
    return data;
  }

  /**
   * Find many with optional filters
   */
  async findMany(filters: Record<string, any> = {}): Promise<T[]> {
    let query = this.supabase.from(this.tableName).select('*');
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
    
    const { data, error } = await query;
    
    if (error) {
      this.handleError(error, 'findMany');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Find many by IDs
   */
  async findByIds(ids: string[]): Promise<T[]> {
    if (ids.length === 0) return [];
    
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .in('id', ids);
    
    if (error) {
      this.handleError(error, 'findByIds');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Find with pagination
   */
  async findPaginated(
    filters: Record<string, any> = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ data: T[]; count: number; page: number; pageSize: number; totalPages: number }> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    let query = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact' });
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
    
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) {
      this.handleError(error, 'findPaginated');
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
   * Create record
   */
  async create(data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single();
    
    if (error) {
      this.handleError(error, 'create');
      throw error;
    }
    
    return result;
  }

  /**
   * Create multiple records
   */
  async createMany(data: Partial<T>[]): Promise<T[]> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(data)
      .select();
    
    if (error) {
      this.handleError(error, 'createMany');
      throw error;
    }
    
    return result || [];
  }

  /**
   * Update record
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      this.handleError(error, 'update');
      throw error;
    }
    
    return result;
  }

  /**
   * Update multiple records by filter
   */
  async updateMany(filters: Record<string, any>, data: Partial<T>): Promise<T[]> {
    let query = this.supabase.from(this.tableName).update(data);
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
    
    const { data: result, error } = await query.select();
    
    if (error) {
      this.handleError(error, 'updateMany');
      throw error;
    }
    
    return result || [];
  }

  /**
   * Delete record
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);
    
    if (error) {
      this.handleError(error, 'delete');
      throw error;
    }
  }

  /**
   * Delete multiple records by filter
   */
  async deleteMany(filters: Record<string, any>): Promise<void> {
    let query = this.supabase.from(this.tableName).delete();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
    
    const { error } = await query;
    
    if (error) {
      this.handleError(error, 'deleteMany');
      throw error;
    }
  }

  /**
   * Soft delete (sets deleted_at timestamp)
   * Only works if table has deleted_at column
   */
  async softDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      this.handleError(error, 'softDelete');
      throw error;
    }
  }

  /**
   * Restore soft-deleted record
   */
  async restore(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ deleted_at: null })
      .eq('id', id);
    
    if (error) {
      this.handleError(error, 'restore');
      throw error;
    }
  }

  /**
   * Count records with optional filters
   */
  async count(filters: Record<string, any> = {}): Promise<number> {
    let query = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
    
    const { count, error } = await query;
    
    if (error) {
      this.handleError(error, 'count');
      throw error;
    }
    
    return count || 0;
  }

  /**
   * Check if record exists
   */
  async exists(id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('id')
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      this.handleError(error, 'exists');
      throw error;
    }
    
    return !!data;
  }

  /**
   * Custom query builder for complex queries
   */
  query() {
    return this.supabase.from(this.tableName).select('*');
  }

  /**
   * Error handling with context
   */
  protected handleError(error: PostgrestError, operation: string): void {
    console.error(`[BaseRepository:${this.tableName}] ${operation} error:`, {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
  }
}
