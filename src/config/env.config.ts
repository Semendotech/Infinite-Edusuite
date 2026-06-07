/**
 * Environment configuration with validation
 * Centralizes all environment variable access and validation
 */

/**
 * Environment variable names
 */
export const EnvVar = {
  // Supabase
  SUPABASE_URL: 'SUPABASE_URL',
  SUPABASE_PUBLISHABLE_KEY: 'SUPABASE_PUBLISHABLE_KEY',
  SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
  VITE_SUPABASE_URL: 'VITE_SUPABASE_URL',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'VITE_SUPABASE_PUBLISHABLE_KEY',
  VITE_SUPABASE_PROJECT_ID: 'VITE_SUPABASE_PROJECT_ID',
  
  // App
  NODE_ENV: 'NODE_ENV',
  APP_ENV: 'APP_ENV',
  APP_URL: 'APP_URL',
  APP_NAME: 'APP_NAME',
  
  // Features
  ENABLE_AUDIT_LOGGING: 'ENABLE_AUDIT_LOGGING',
  ENABLE_BRANCH_ISOLATION: 'ENABLE_BRANCH_ISOLATION',
  
  // Rate Limiting
  RATE_LIMIT_MAX_REQUESTS: 'RATE_LIMIT_MAX_REQUESTS',
  RATE_LIMIT_WINDOW_MS: 'RATE_LIMIT_WINDOW_MS',
  
  // Session
  SESSION_TIMEOUT_MINUTES: 'SESSION_TIMEOUT_MINUTES',
  
  // Upload
  MAX_FILE_SIZE_MB: 'MAX_FILE_SIZE_MB',
  ALLOWED_FILE_TYPES: 'ALLOWED_FILE_TYPES',
} as const;

/**
 * Environment configuration interface
 */
export interface EnvConfig {
  // Supabase
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey?: string;
  
  // App
  nodeEnv: 'development' | 'production' | 'test';
  appEnv: 'development' | 'staging' | 'production';
  appUrl: string;
  appName: string;
  
  // Features
  enableAuditLogging: boolean;
  enableBranchIsolation: boolean;
  
  // Rate Limiting
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  
  // Session
  sessionTimeoutMinutes: number;
  
  // Upload
  maxFileSizeMB: number;
  allowedFileTypes: string[];
  
  // Is client-side
  isClient: boolean;
  isServer: boolean;
}

/**
 * Get environment variable with fallback
 */
function getEnvVar(key: string, fallback?: string): string {
  // Client-side: use import.meta.env (Vite)
  if (typeof window !== 'undefined') {
    return (import.meta.env as any)[key] || fallback || '';
  }
  
  // Server-side: use process.env
  return process.env[key] || fallback || '';
}

/**
 * Get boolean environment variable
 */
function getBooleanEnvVar(key: string, fallback: boolean = false): boolean {
  const value = getEnvVar(key).toLowerCase();
  return value === 'true' || value === '1' || fallback;
}

/**
 * Get number environment variable
 */
function getNumberEnvVar(key: string, fallback: number = 0): number {
  const value = getEnvVar(key);
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Get array environment variable (comma-separated)
 */
function getArrayEnvVar(key: string, fallback: string[] = []): string[] {
  const value = getEnvVar(key);
  if (!value) return fallback;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Validate required environment variables
 */
function validateRequiredEnvVars(): void {
  const requiredVars = [
    EnvVar.SUPABASE_URL,
    EnvVar.SUPABASE_PUBLISHABLE_KEY,
  ];
  
  const missing = requiredVars.filter(key => !getEnvVar(key));
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Get environment configuration
 */
export function getEnvConfig(): EnvConfig {
  // Validate required variables
  validateRequiredEnvVars();
  
  // Determine environment
  const nodeEnv = (getEnvVar(EnvVar.NODE_ENV, 'development') as 'development' | 'production' | 'test');
  const appEnv = (getEnvVar(EnvVar.APP_ENV, nodeEnv) as 'development' | 'staging' | 'production');
  
  // Client-side vs server-side
  const isClient = typeof window !== 'undefined';
  const isServer = !isClient;
  
  return {
    // Supabase
    supabaseUrl: getEnvVar(EnvVar.VITE_SUPABASE_URL) || getEnvVar(EnvVar.SUPABASE_URL),
    supabasePublishableKey: getEnvVar(EnvVar.VITE_SUPABASE_PUBLISHABLE_KEY) || getEnvVar(EnvVar.SUPABASE_PUBLISHABLE_KEY),
    supabaseServiceRoleKey: isServer ? getEnvVar(EnvVar.SUPABASE_SERVICE_ROLE_KEY) : undefined,
    
    // App
    nodeEnv,
    appEnv,
    appUrl: getEnvVar(EnvVar.APP_URL, isClient ? window.location.origin : 'http://localhost:5173'),
    appName: getEnvVar(EnvVar.APP_NAME, 'Infinite EduSuite'),
    
    // Features
    enableAuditLogging: getBooleanEnvVar(EnvVar.ENABLE_AUDIT_LOGGING, true),
    enableBranchIsolation: getBooleanEnvVar(EnvVar.ENABLE_BRANCH_ISOLATION, true),
    
    // Rate Limiting
    rateLimitMaxRequests: getNumberEnvVar(EnvVar.RATE_LIMIT_MAX_REQUESTS, 100),
    rateLimitWindowMs: getNumberEnvVar(EnvVar.RATE_LIMIT_WINDOW_MS, 60000),
    
    // Session
    sessionTimeoutMinutes: getNumberEnvVar(EnvVar.SESSION_TIMEOUT_MINUTES, 60),
    
    // Upload
    maxFileSizeMB: getNumberEnvVar(EnvVar.MAX_FILE_SIZE_MB, 10),
    allowedFileTypes: getArrayEnvVar(EnvVar.ALLOWED_FILE_TYPES, ['image/jpeg', 'image/png', 'application/pdf']),
    
    // Is client/server
    isClient,
    isServer,
  };
}

/**
 * Singleton instance
 */
let envConfig: EnvConfig | null = null;

/**
 * Get cached environment configuration
 */
export function env(): EnvConfig {
  if (!envConfig) {
    envConfig = getEnvConfig();
  }
  return envConfig;
}

/**
 * Reset environment configuration (useful for testing)
 */
export function resetEnvConfig(): void {
  envConfig = null;
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return env().nodeEnv === 'development';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return env().nodeEnv === 'production';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return env().nodeEnv === 'test';
}

/**
 * Check if running in staging
 */
export function isStaging(): boolean {
  return env().appEnv === 'staging';
}
