// Verdiq and RenewLoop sessions come from vamaha-backend's session broker
// (POST /app-sessions/:appId); their service credentials live only in that
// backend's env (VERDIQ_SERVICE_*, RENEWLOOP_SERVICE_*), never in this bundle.
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:9991/api',
  siteUrl: 'https://vamaha.tech',
  verdiq: {
    apiBaseUrl: 'http://localhost:3009',
  },
  renewloop: {
    // sbmint backend — update once it's deployed; local dev for now.
    apiBaseUrl: 'http://127.0.0.1:3300',
  },
};
