export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:9991/api',
  siteUrl: 'https://vamaha.tech',
  verdiq: {
    apiBaseUrl: 'http://localhost:3009',
    // Fill in a real verdiq-backend admin account before running locally —
    // never commit real values here.
    serviceEmail: 'vamsi973@yahoo.com',
    servicePassword: 'kapilNoteBook@9$',
  },
  renewloop: {
    // sbmint backend — update once it's deployed; local dev for now.
    apiBaseUrl: 'http://127.0.0.1:3300',
    // Created via ADMIN_EMAIL/ADMIN_PASSWORD_HASH in the sbmint backend's
    // .env (see backend/.env.example). Fill in a real account before
    // running locally — never commit real values here.
    serviceEmail: 'vamsi973@yahoo.com',
    servicePassword: 'ALI8hlTSXRm38taXZR!',
  },
};
