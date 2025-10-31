/**
 * Sentry configuration for server-side (Vercel functions)
 */

import * as Sentry from '@sentry/node';

const initSentry = () => {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.warn('Sentry DSN not configured for server');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      // No additional integrations needed for Node.js
    ],
    beforeSend(event, hint) {
      // Filter out sensitive information
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });
};

export default initSentry;

