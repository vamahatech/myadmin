#!/usr/bin/env node
// Runs as the "prebuild" hook (see package.json), before every `npm run build`.
//
// It used to write the Verdiq service-account email/password into
// environment.ts, which shipped them in the browser bundle. myadmin now gets
// Verdiq and RenewLoop sessions from vamaha-backend's session broker
// (POST /app-sessions/:appId), so those credentials belong in vamaha-backend's
// env (VERDIQ_SERVICE_EMAIL/PASSWORD, RENEWLOOP_SERVICE_EMAIL/PASSWORD) and this
// hook only warns if they are still set on the frontend build.

if (process.env.VERDIQ_SERVICE_EMAIL || process.env.VERDIQ_SERVICE_PASSWORD) {
  console.warn(
    '[inject-verdiq-env] VERDIQ_SERVICE_* is set for the myadmin build but is no longer used. ' +
      'Remove it from the frontend project (Vercel) and set it on vamaha-backend instead.',
  );
}
