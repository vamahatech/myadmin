#!/usr/bin/env node
// Runs as the "prebuild" hook (see package.json), before every `npm run build`.
// Patches the verdiq service-account placeholders in environment.ts with real
// values from VERDIQ_SERVICE_EMAIL / VERDIQ_SERVICE_PASSWORD env vars, set in
// Vercel's dashboard (Project Settings -> Environment Variables), never in git.
//
// Local dev is unaffected: `ng serve` doesn't invoke this script, so the
// existing manual edit-environment.ts-and-don't-commit-it workflow still works.
//
// Note: this only keeps the credential out of source control. It still ends
// up in the compiled JS bundle shipped to the browser, same as it does today
// — Angular has no build-time secret that stays hidden from the client.

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', 'src', 'environments', 'environment.ts');

const email = process.env.VERDIQ_SERVICE_EMAIL;
const password = process.env.VERDIQ_SERVICE_PASSWORD;

if (!email || !password) {
  console.log(
    '[inject-verdiq-env] VERDIQ_SERVICE_EMAIL/PASSWORD not set — leaving environment.ts placeholders as-is.',
  );
  process.exit(0);
}

let content = fs.readFileSync(ENV_FILE, 'utf8');

const escape = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const before = content;
content = content.replace(
  /serviceEmail:\s*'[^']*'/,
  `serviceEmail: '${escape(email)}'`,
);
content = content.replace(
  /servicePassword:\s*'[^']*'/,
  `servicePassword: '${escape(password)}'`,
);

if (content === before) {
  console.error('[inject-verdiq-env] Could not find serviceEmail/servicePassword fields to replace.');
  process.exit(1);
}

fs.writeFileSync(ENV_FILE, content);
console.log('[inject-verdiq-env] Injected verdiq service-account credentials into environment.ts.');
