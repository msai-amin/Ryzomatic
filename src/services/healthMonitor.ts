/**
 * Health Monitoring Service
 * Provides system health checks, monitoring, and alerting
 */

import { logger, LogContext } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';
import { performanceOptimizer } from './performanceOptimizer';

export interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
  timeout?: number;
  critical?: boolean;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, {
    status: 'pass' | 'fail' | 'timeout';
    duration: number;
    error?: string;
    critical: boolean;
  }>;
  timestamp: number;
  uptime: number;
  memoryUsage?: number;
  performance: {
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: number;
  resolved?: boolean;
  context?: LogContext;
}

class HealthMonitor {
  private static instance: HealthMonitor;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private healthStatus: HealthStatus | null = null;
  private alerts: Alert[] = [];
  private startTime: number = Date.now();
  private maxAlerts: number = 100;
  private checkInterval: number = 30000; // 30 seconds
  private intervalId: NodeJS.Timeout | null = null;
  private alertCallbacks: ((alert: Alert) => void)[] = [];

  private constructor() {
    this.setupDefaultHealthChecks();
    this.startMonitoring();
  }

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  private setupDefaultHealthChecks(): void {
    // Memory usage check
    this.addHealthCheck({
      name: 'memory',
      check: async () => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          const usedMB = memory.usedJSHeapSize / 1024 / 1024;
          const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
          const usagePercent = (usedMB / limitMB) * 100;
          
          // Alert if memory usage is above 80%
          if (usagePercent > 80) {
            this.createAlert('warning', `High memory usage: ${usagePercent.toFixed(1)}%`);
          }
          
          return usagePercent < 90; // Fail if above 90%
        }
        return true; // Pass if memory API not available
      },
      critical: true
    });

    // Error rate check
    this.addHealthCheck({
      name: 'errorRate',
      check: async () => {
        const errorHistory = errorHandler.getErrorHistory();
        const recentErrors = errorHistory.filter(error => 
          Date.now() - new Date(error.timestamp).getTime() < 300000 // Last 5 minutes
        );
        
        const criticalErrors = recentErrors.filter(error => 
          error.severity === ErrorSeverity.CRITICAL
        );
        
        if (criticalErrors.length > 0) {
          this.createAlert('error', `${criticalErrors.length} critical errors in the last 5 minutes`);
        }
        
        return criticalErrors.length < 3; // Fail if more than 3 critical errors
      },
      critical: true
    });

    // Performance check
    this.addHealthCheck({
      name: 'performance',
      check: async () => {
        const stats = performanceOptimizer.getPerformanceStats();
        const performanceStats = stats.performance || {};
        const avgResponseTime = Object.values(performanceStats)
          .reduce((sum: number, stat: any) => sum + (stat.averageDuration || 0), 0) as number;
        
        if (avgResponseTime > 5000) { // 5 seconds
          this.createAlert('warning', `High average response time: ${avgResponseTime.toFixed(0)}ms`);
        }
        
        return avgResponseTime < 10000; // Fail if above 10 seconds
      }
    });

    // Cache performance check
    this.addHealthCheck({
      name: 'cache',
      check: async () => {
        const stats = performanceOptimizer.getStats();
        const cacheSize = stats.cache.size;
        const maxSize = stats.cache.maxSize;
        
        if (cacheSize > maxSize * 0.9) {
          this.createAlert('warning', `Cache nearly full: ${cacheSize}/${maxSize}`);
        }
        
        return cacheSize < maxSize;
      }
    });

    // Network connectivity check (basic)
    this.addHealthCheck({
      name: 'connectivity',
      check: async () => {
        try {
          // Simple connectivity check
          const response = await fetch('/api/health', { 
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });
          return response.ok;
        } catch (error) {
          this.createAlert('warning', 'Network connectivity issues detected');
          return false;
        }
      },
      timeout: 5000,
      critical: true
    });
  }

  public addHealthCheck(healthCheck: HealthCheck): void {
    const context: LogContext = {
      component: 'HealthMonitor',
      action: 'addHealthCheck'
    };

    this.healthChecks.set(healthCheck.name, healthCheck);
    logger.info(`Health check added: ${healthCheck.name}`, context, {
      critical: healthCheck.critical,
      timeout: healthCheck.timeout
    });
  }

  public removeHealthCheck(name: string): void {
    const context: LogContext = {
      component: 'HealthMonitor',
      action: 'removeHealthCheck'
    };

    const removed = this.healthChecks.delete(name);
    if (removed) {
      logger.info(`Health check removed: ${name}`, context);
    }
  }

  public async runHealthChecks(): Promise<HealthStatus> {
    const context: LogContext = {
      component: 'HealthMonitor',
      action: 'runHealthChecks'
    };

    const startTime = Date.now();
    const checks: Record<string, any> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let criticalFailures = 0;
    let totalFailures = 0;

    logger.info('Running health checks', context, {
      checkCount: this.healthChecks.size
    });

    for (const [name, healthCheck] of this.healthChecks) {
      const checkStartTime = Date.now();
      let status: 'pass' | 'fail' | 'timeout' = 'pass';
      let error: string | undefined;

      try {
        const timeout = healthCheck.timeout || 10000; // 10 seconds default
        const timeoutPromise = new Promise<boolean>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), timeout);
        });

        const result = await Promise.race([
          healthCheck.check(),
          timeoutPromise
        ]);

        if (!result) {
          status = 'fail';
          totalFailures++;
          if (healthCheck.critical) {
            criticalFailures++;
          }
        }
      } catch (err) {
        status = err instanceof Error && err.message === 'Health check timeout' ? 'timeout' : 'fail';
        error = err instanceof Error ? err.message : 'Unknown error';
        totalFailures++;
        if (healthCheck.critical) {
          criticalFailures++;
        }
      }

      const duration = Date.now() - checkStartTime;
      checks[name] = {
        status,
        duration,
        error,
        critical: healthCheck.critical || false
      };

      logger.debug(`Health check completed: ${name}`, context, {
        status,
        duration,
        error,
        critical: healthCheck.critical
      });
    }

    // Determine overall status
    if (criticalFailures > 0) {
      overallStatus = 'unhealthy';
    } else if (totalFailures > 0) {
      overallStatus = 'degraded';
    }

    // Get memory usage
    let memoryUsage: number | undefined;
    if ('memory' in performance) {
      memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024;
    }

    // Calculate performance metrics
    const performanceStats = performanceOptimizer.getPerformanceStats();
    const errorHistory = errorHandler.getErrorHistory();
    const recentErrors = errorHistory.filter(error => 
      Date.now() - new Date(error.timestamp).getTime() < 300000 // Last 5 minutes
    );

    const healthStatus: HealthStatus = {
      overall: overallStatus,
      checks,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      memoryUsage,
      performance: {
        averageResponseTime: Object.values(performanceStats).reduce((sum: number, stat: any) => 
          sum + (stat.averageDuration || 0), 0) / Object.keys(performanceStats).length || 0,
        errorRate: recentErrors.length / 300, // Errors per second over 5 minutes
        cacheHitRate: 0.85 // Placeholder - would need cache hit/miss tracking
      }
    };

    this.healthStatus = healthStatus;

    const totalDuration = Date.now() - startTime;
    logger.info('Health checks completed', context, {
      overallStatus,
      totalDuration,
      criticalFailures,
      totalFailures,
      checkCount: this.healthChecks.size
    });

    return healthStatus;
  }

  public getHealthStatus(): HealthStatus | null {
    return this.healthStatus;
  }

  public startMonitoring(): void {
    const context: LogContext = {
      component: 'HealthMonitor',
      action: 'startMonitoring'
    };

    if (this.intervalId) {
      logger.warn('Health monitoring already started', context);
      return;
    }

    this.intervalId = setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        logger.error('Health monitoring error', context, error as Error);
      }
    }, this.checkInterval);

    logger.info('Health monitoring started', context, {
      interval: this.checkInterval
    });
  }

  public stopMonitoring(): void {
    const context: LogContext = {
      component: 'HealthMonitor',
      action: 'stopMonitoring'
    };

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Health monitoring stopped', context);
    }
  }

  public createAlert(type: 'error' | 'warning' | 'info', message: string, context?: LogContext): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: Date.now(),
      context
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // Notify callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Alert callback error', context, error as Error);
      }
    });

    logger.warn(`Alert created: ${type}`, context, undefined, { message, alertId: alert.id });
    logger.warn(`Alert created: ${type}`, context, undefined, { message, alertId: alert.id });
    logger.warn(`Alert created: ${type}`, context, undefined, { message, alertId: alert.id });
    logger.warn(`Alert created: ${type}`, context, undefined, { message, alertId: alert.id });
  }

  public resolveAlert(alertId: string): boolean {
    const context: LogContext = {
      component: 'HealthMonitor',
      action: 'resolveAlert'
    };

    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info(`Alert resolved: ${alertId}`, context);
      return true;
    }
    return false;
  }

  public getAlerts(filter?: { type?: string; resolved?: boolean }): Alert[] {
    let filteredAlerts = this.alerts;

    if (filter) {
      if (filter.type) {
        filteredAlerts = filteredAlerts.filter(alert => alert.type === filter.type);
      }
      if (filter.resolved !== undefined) {
        filteredAlerts = filteredAlerts.filter(alert => alert.resolved === filter.resolved);
      }
    }

    return filteredAlerts;
  }

  public addAlertCallback(callback: (alert: Alert) => void): void {
    this.alertCallbacks.push(callback);
  }

  public removeAlertCallback(callback: (alert: Alert) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  public getStats(): Record<string, any> {
    const healthStatus = this.getHealthStatus();
    const alerts = this.getAlerts();

    return {
      health: {
        status: healthStatus?.overall || 'unknown',
        uptime: Date.now() - this.startTime,
        lastCheck: healthStatus?.timestamp || 0,
        checkCount: this.healthChecks.size
      },
      alerts: {
        total: alerts.length,
        unresolved: alerts.filter(a => !a.resolved).length,
        byType: {
          error: alerts.filter(a => a.type === 'error').length,
          warning: alerts.filter(a => a.type === 'warning').length,
          info: alerts.filter(a => a.type === 'info').length
        }
      },
      monitoring: {
        active: this.intervalId !== null,
        interval: this.checkInterval
      }
    };
  }
}

// Export singleton instance
export const healthMonitor = HealthMonitor.getInstance();

// Convenience functions
export const addHealthCheck = (healthCheck: HealthCheck) =>
  healthMonitor.addHealthCheck(healthCheck);

export const runHealthChecks = () => healthMonitor.runHealthChecks();

export const getHealthStatus = () => healthMonitor.getHealthStatus();

export const createAlert = (type: 'error' | 'warning' | 'info', message: string, context?: LogContext) =>
  healthMonitor.createAlert(type, message, context);
