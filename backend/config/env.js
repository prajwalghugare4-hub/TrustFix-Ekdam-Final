import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Always load the project-root .env, even when the server is started from
// inside backend/ (e.g. `node server.js` instead of `npm run server`).
// `override: true` makes this project's .env win over inherited shell
// variables (some tools export a global PORT that would move the API).
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
dotenv.config({ path: path.join(projectRoot, '.env'), override: true });

export const PORT = Number(process.env.PORT) || 5000;

export const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || 'http://localhost:4321';

export const JWT_SECRET =
  process.env.JWT_SECRET || 'trustfix-dev-secret-change-me';

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const isProduction = process.env.NODE_ENV === 'production';
