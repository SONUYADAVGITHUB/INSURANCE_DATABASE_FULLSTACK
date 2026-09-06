export const environment = {
  production: true,
  apiBaseUrl: '/api',
  // Empty on purpose: in production this is served from the same host as
  // the API (behind a reverse proxy), so SystemService derives ws:// or
  // wss:// from window.location at runtime instead of a fixed URL here.
  wsBaseUrl: ''
};
