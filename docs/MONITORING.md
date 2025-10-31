# Monitoring & Observability Guide

## Overview

Smart Reader uses multiple monitoring tools to track application health, performance, and errors.

## Monitoring Stack

### 1. Error Tracking
**Tool:** Sentry  
**URL:** Configured per environment

**Features:**
- Frontend error tracking
- API error tracking
- Source map debugging
- User context and breadcrumbs
- Performance monitoring

**Configuration:**
- Client: `sentry.client.config.ts`
- Server: `sentry.server.config.ts`
- Integrations: Browser tracing, Replay

### 2. Performance Monitoring
**Tools:** 
- Vercel Analytics (Core Web Vitals)
- Custom Logger Service
- Performance Optimizer

**Metrics Tracked:**
- Page load time
- API response times
- Memory usage
- Cache hit rates

### 3. Uptime Monitoring
**Tools:**
- UptimeRobot (external)
- Custom health endpoint: `/api/health`

**Health Checks:**
- Database connectivity
- Environment variables
- S3 access

### 4. Application Monitoring
**Existing Services:**
- `healthMonitor.ts` - System health
- `performanceOptimizer.ts` - Performance tracking
- `logger.ts` - Structured logging

## Health Endpoint

**URL:** `https://your-app.vercel.app/api/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": "healthy",
    "environment": "healthy"
  }
}
```

## Alerting Rules

### Critical (Immediate notification)
- API error rate > 5% in 5 minutes
- Database connection failures
- S3 access errors
- Authentication failure spike

### Warning (15-minute delay)
- API response time > 500ms (p95)
- Memory usage > 80%
- High error rate for specific users

### Info
- Deployment notifications
- Daily performance summary

## Dashboards

### External Dashboards
1. **Vercel Dashboard** - Deployments, analytics, logs
2. **Supabase Dashboard** - Database metrics, auth stats
3. **AWS CloudWatch** - S3 metrics
4. **Sentry Dashboard** - Error tracking, performance
5. **GitHub Actions** - CI/CD pipeline status

### Custom Dashboard
**Location:** `/admin/monitoring` (to be implemented)

**Metrics Displayed:**
- System health status
- Performance metrics
- Error history
- Database performance
- Real-time logs

## Logging Strategy

### Frontend Logging
- Structured logging via `logger.ts`
- Error boundaries with Sentry
- Console logs only in development

### Backend Logging (API Routes)
- Vercel function logs (automatic)
- Structured logging to Supabase
- Performance logging via `query_performance_log`

## Setting Up Monitoring

### 1. Configure Sentry

Add to environment variables:
```bash
VITE_SENTRY_DSN=your-sentry-dsn
```

### 2. Set Up UptimeRobot

1. Create account at uptimerobot.com
2. Add monitor: `https://your-app.vercel.app`
3. Set interval: 5 minutes
4. Configure alert email

### 3. Enable Vercel Analytics

Already enabled via Vercel dashboard:
- Web Analytics
- Speed Insights

### 4. Configure Alerts

Set up notifications for:
- Sentry: Email/Slack for critical errors
- UptimeRobot: Email for downtime
- GitHub Actions: Email for failed deployments

## Troubleshooting

### High Error Rate
1. Check Sentry dashboard
2. Review recent deployments
3. Check database logs
4. Verify external service status

### Performance Issues
1. Check Vercel Analytics
2. Review performance logs
3. Check database query performance
4. Verify S3 access patterns

### Health Check Failures
1. Verify database connection
2. Check environment variables
3. Review Supabase status
4. Check AWS S3 status

## Best Practices

1. **Monitor continuously** - Set up alerts
2. **Track trends** - Watch for degradation
3. **Respond quickly** - < 15 minutes MTTR
4. **Document incidents** - Learn from errors
5. **Review regularly** - Weekly metrics review

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Vercel Analytics](https://vercel.com/docs/analytics)
- [UptimeRobot Guide](https://uptimerobot.com/learn/)
- [Supabase Monitoring](https://supabase.com/docs/guides/platform/performance)

