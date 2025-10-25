/**
 * Production Guard Utilities
 * Ensures production environment is completely insulated from development
 */

export const isProduction = import.meta.env.PROD;
export const isDevelopment = import.meta.env.DEV;

/**
 * Production-only function execution
 * Only runs the function in production environment
 */
export function productionOnly<T>(fn: () => T): T | undefined {
  if (isProduction) {
    return fn();
  }
  return undefined;
}

/**
 * Development-only function execution
 * Only runs the function in development environment
 */
export function developmentOnly<T>(fn: () => T): T | undefined {
  if (isDevelopment) {
    return fn();
  }
  return undefined;
}

/**
 * Safe console logging that respects environment
 */
export const safeConsole = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors, but with different levels
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production, use a more structured error logging
      console.error('[PROD ERROR]', ...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  }
};

/**
 * Environment-specific configuration
 */
export const getEnvironmentConfig = () => {
  return {
    isProduction,
    isDevelopment,
    apiBaseUrl: isProduction 
      ? 'https://smart-reader-serverless.vercel.app' 
      : 'http://localhost:3001',
    enableDebugLogs: isDevelopment,
    enablePerformanceMonitoring: isProduction,
    localStoragePrefix: isProduction ? 'prod_smart_reader' : 'dev_smart_reader'
  };
};

/**
 * Production-safe storage keys
 * Ensures local and production storage don't interfere
 */
export const getStorageKeys = () => {
  const prefix = isProduction ? 'prod_smart_reader' : 'dev_smart_reader';
  return {
    books: `${prefix}_books`,
    notes: `${prefix}_notes`,
    audio: `${prefix}_audio`,
    settings: `${prefix}_settings`,
    cache: `${prefix}_cache`
  };
};

/**
 * Validate production environment
 * Throws error if critical production requirements are missing
 */
export function validateProductionEnvironment(): void {
  if (!isProduction) return;

  const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_GEMINI_API_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missingVars.join(', ')}`);
  }
}

/**
 * Production-safe error handling
 */
export function handleProductionError(error: Error, context: string): void {
  if (isProduction) {
    // In production, log errors but don't expose sensitive information
    console.error(`[PROD ERROR] ${context}:`, {
      message: error.message,
      name: error.name,
      timestamp: new Date().toISOString()
    });
  } else {
    // In development, show full error details
    console.error(`[DEV ERROR] ${context}:`, error);
  }
}
