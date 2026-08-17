export const environment = {
  production: false,
  apiBaseUrl: 'https://backend-usqv.onrender.com/api',
  siteUrl: 'https://vamaha.tech',
  verdiq: {
    apiBaseUrl: 'https://know-ingredients-backend.onrender.com',
    // Fill in a real verdiq-backend admin account before running locally —
    // never commit real values here.
  serviceEmail: 'REPLACE_WITH_SERVICE_ACCOUNT_EMAIL',
    servicePassword: 'REPLACE_WITH_SERVICE_ACCOUNT_PASSWORD',
  },
  renewloop: {
    // sbmint backend — update once it's deployed; local dev for now.
    apiBaseUrl: 'http://127.0.0.1:3300',
    // Created via ADMIN_EMAIL/ADMIN_PASSWORD_HASH in the sbmint backend's
    // .env (see backend/.env.example). Fill in a real account before
    // running locally — never commit real values here.
    serviceEmail: 'REPLACE_WITH_SERVICE_ACCOUNT_EMAIL',
    servicePassword: 'REPLACE_WITH_SERVICE_ACCOUNT_PASSWORD',
  },
};
