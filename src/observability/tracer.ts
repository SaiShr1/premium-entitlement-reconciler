import tracer from 'dd-trace';

tracer.init({
  service: 'premium-entitlement-reconciler',
  env: process.env.NODE_ENV ?? 'development',
  logInjection: true,
});

export default tracer;