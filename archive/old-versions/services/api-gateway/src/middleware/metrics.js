const logger = require('../utils/logger');

// In-memory metrics storage (in production, use a proper metrics service)
const metrics = {
  requests: {
    total: 0,
    byMethod: {},
    byStatus: {},
    byService: {},
    byEndpoint: {}
  },
  responseTimes: [],
  errors: {
    total: 0,
    byType: {},
    byService: {}
  },
  activeConnections: 0
};

const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Increment active connections
  metrics.activeConnections++;
  
  // Track request
  metrics.requests.total++;
  
  // Track by method
  metrics.requests.byMethod[req.method] = (metrics.requests.byMethod[req.method] || 0) + 1;
  
  // Track by service
  const service = getServiceFromPath(req.path);
  if (service) {
    metrics.requests.byService[service] = (metrics.requests.byService[service] || 0) + 1;
  }
  
  // Track by endpoint
  const endpoint = `${req.method} ${req.path}`;
  metrics.requests.byEndpoint[endpoint] = (metrics.requests.byEndpoint[endpoint] || 0) + 1;
  
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    
    // Track response time
    metrics.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times
    if (metrics.responseTimes.length > 1000) {
      metrics.responseTimes = metrics.responseTimes.slice(-1000);
    }
    
    // Track by status
    const status = res.statusCode;
    metrics.requests.byStatus[status] = (metrics.requests.byStatus[status] || 0) + 1;
    
    // Track errors
    if (status >= 400) {
      metrics.errors.total++;
      metrics.errors.byType[status] = (metrics.errors.byType[status] || 0) + 1;
      
      if (service) {
        metrics.errors.byService[service] = (metrics.errors.byService[service] || 0) + 1;
      }
    }
    
    // Decrement active connections
    metrics.activeConnections--;
    
    // Set response time header
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    
    // Call original res.end
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

const getServiceFromPath = (path) => {
  if (path.startsWith('/api/documents')) return 'document-processing';
  if (path.startsWith('/api/chat')) return 'chat-api';
  if (path.startsWith('/api/files')) return 'file-storage';
  if (path.startsWith('/api/ai')) return 'ai-integration';
  if (path.startsWith('/api/vectors')) return 'vector-db';
  return 'api-gateway';
};

const getMetrics = () => {
  const responseTimes = metrics.responseTimes;
  const avgResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
    : 0;
  
  const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b);
  const p50 = sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.5)] || 0;
  const p95 = sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)] || 0;
  const p99 = sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.99)] || 0;
  
  return {
    ...metrics,
    performance: {
      averageResponseTime: Math.round(avgResponseTime),
      p50ResponseTime: Math.round(p50),
      p95ResponseTime: Math.round(p95),
      p99ResponseTime: Math.round(p99),
      totalRequests: metrics.requests.total,
      requestsPerMinute: calculateRequestsPerMinute(),
      errorRate: calculateErrorRate()
    }
  };
};

const calculateRequestsPerMinute = () => {
  // This is a simplified calculation
  // In production, you'd track this over time windows
  return Math.round(metrics.requests.total / (Date.now() / (1000 * 60)));
};

const calculateErrorRate = () => {
  if (metrics.requests.total === 0) return 0;
  return Math.round((metrics.errors.total / metrics.requests.total) * 100);
};

const resetMetrics = () => {
  metrics.requests = {
    total: 0,
    byMethod: {},
    byStatus: {},
    byService: {},
    byEndpoint: {}
  };
  metrics.responseTimes = [];
  metrics.errors = {
    total: 0,
    byType: {},
    byService: {}
  };
  metrics.activeConnections = 0;
  
  logger.info('Metrics reset');
};

const logMetrics = () => {
  const currentMetrics = getMetrics();
  logger.info('Current metrics:', {
    totalRequests: currentMetrics.requests.total,
    activeConnections: currentMetrics.activeConnections,
    averageResponseTime: currentMetrics.performance.averageResponseTime,
    errorRate: currentMetrics.performance.errorRate
  });
};

// Log metrics every 5 minutes
setInterval(logMetrics, 5 * 60 * 1000);

module.exports = {
  metricsMiddleware,
  getMetrics,
  resetMetrics,
  logMetrics
};
