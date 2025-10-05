/**
 * Health Status Component
 * Displays system health information and monitoring status
 */

import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw, Info } from 'lucide-react';
import { healthMonitor, HealthStatus } from '../services/healthMonitor';
import { logger } from '../services/logger';

interface HealthStatusProps {
  showDetails?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const HealthStatusComponent: React.FC<HealthStatusProps> = ({
  showDetails = false,
  autoRefresh = true,
  refreshInterval = 30000
}) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealthStatus = async () => {
    const context = {
      component: 'HealthStatusComponent',
      action: 'fetchHealthStatus'
    };

    setLoading(true);
    setError(null);

    try {
      logger.info('Fetching health status', context);
      const status = await healthMonitor.runHealthChecks();
      setHealthStatus(status);
      setLastUpdated(new Date());
      logger.info('Health status updated', context, {
        overallStatus: status.overall,
        checkCount: Object.keys(status.checks).length
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch health status';
      setError(errorMessage);
      logger.error('Health status fetch failed', context, err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchHealthStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'unhealthy':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatMemoryUsage = (usage: number) => {
    if (usage < 1024) return `${usage.toFixed(1)} MB`;
    return `${(usage / 1024).toFixed(1)} GB`;
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <XCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-800 font-medium">Health Check Failed</span>
        </div>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={fetchHealthStatus}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!healthStatus) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-gray-500 animate-pulse" />
          <span className="text-gray-600">Loading health status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className={`p-4 border rounded-lg ${getStatusColor(healthStatus.overall)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon(healthStatus.overall)}
            <span className="font-medium capitalize">{healthStatus.overall} Status</span>
          </div>
          <div className="flex items-center space-x-2">
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            <button
              onClick={fetchHealthStatus}
              className="text-sm hover:underline"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
        
        {lastUpdated && (
          <p className="text-sm mt-1 opacity-75">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Uptime</div>
          <div className="font-medium">{formatUptime(healthStatus.uptime)}</div>
        </div>
        
        {healthStatus.memoryUsage && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Memory</div>
            <div className="font-medium">{formatMemoryUsage(healthStatus.memoryUsage)}</div>
          </div>
        )}
        
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Response Time</div>
          <div className="font-medium">{healthStatus.performance.averageResponseTime.toFixed(0)}ms</div>
        </div>
        
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Error Rate</div>
          <div className="font-medium">{(healthStatus.performance.errorRate * 100).toFixed(2)}%</div>
        </div>
      </div>

      {/* Detailed Checks */}
      {showDetails && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900">Health Checks</h3>
          <div className="space-y-2">
            {Object.entries(healthStatus.checks).map(([name, check]) => (
              <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  {check.status === 'pass' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : check.status === 'fail' ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="font-medium capitalize">{name}</span>
                  {check.critical && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                      Critical
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {check.duration}ms
                  {check.error && (
                    <div className="text-red-600 text-xs mt-1">{check.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {showDetails && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900">Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600">Average Response Time</div>
              <div className="font-medium text-blue-900">
                {healthStatus.performance.averageResponseTime.toFixed(0)}ms
              </div>
            </div>
            
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="text-sm text-orange-600">Error Rate</div>
              <div className="font-medium text-orange-900">
                {(healthStatus.performance.errorRate * 100).toFixed(2)}%
              </div>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600">Cache Hit Rate</div>
              <div className="font-medium text-green-900">
                {(healthStatus.performance.cacheHitRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthStatusComponent;
