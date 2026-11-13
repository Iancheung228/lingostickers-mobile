// Which Supabase project a script talks to (the Node twin of backend.sh).
//
//   (default)              staging     .env             .maestro/qa.env
//   TABI_ENV=production    production  .env.production  .maestro/qa.production.env
//
// Staging is the default on purpose: reaching real users' data takes saying so.
import { existsSync, readFileSync } from 'node:fs';

export const readEnvFile = (p) => Object.fromEntries(
  readFileSync(p, 'utf8').split('\n')
    .filter((l) => /^\w+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; }),
);

const refOf = (url) => url?.match(/^https:\/\/([^.]+)\./)?.[1];

export const TABI_ENV = process.env.TABI_ENV ?? 'staging';
const FILES = {
  staging: { envFile: '.env', qaEnvFile: '.maestro/qa.env' },
  production: { envFile: '.env.production', qaEnvFile: '.maestro/qa.production.env' },
};
if (!FILES[TABI_ENV]) throw new Error(`TABI_ENV must be staging or production, not "${TABI_ENV}"`);
export const { envFile, qaEnvFile } = FILES[TABI_ENV];
if (!existsSync(envFile)) throw new Error(`Missing ${envFile} (see RELEASING.md, "Environments")`);

export const env = readEnvFile(envFile);
export const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
export const ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const PROJECT_REF = refOf(SUPABASE_URL);

// The one mistake this file exists to stop: .env quietly pointing at production.
if (TABI_ENV === 'staging' && existsSync('.env.production')
    && refOf(readEnvFile('.env.production').EXPO_PUBLIC_SUPABASE_URL) === PROJECT_REF) {
  throw new Error(`.env points at the PRODUCTION project (${PROJECT_REF}). It must point at staging; use TABI_ENV=production to mean production.`);
}

export const qaAccount = () => {
  if (!existsSync(qaEnvFile)) throw new Error(`Missing ${qaEnvFile}; create it with TABI_ENV=${TABI_ENV} .maestro/create-qa-user.sh`);
  return readEnvFile(qaEnvFile);
};
