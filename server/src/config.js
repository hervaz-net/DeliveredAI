import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
export const WEB_DIST = path.resolve(SERVER_ROOT, '../web/dist');

const isProd = process.env.NODE_ENV === 'production';
const dataDir = path.join(SERVER_ROOT, 'data');

function resolveSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (isProd) throw new Error('JWT_SECRET must be set in production');
  // Dev only: persist a generated secret so sessions survive restarts.
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, '.jwt-secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString('hex'));
  return fs.readFileSync(file, 'utf8').trim();
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  dbPath: process.env.DATABASE_PATH || path.join(dataDir, 'deliveredai.db'),
  jwtSecret: resolveSecret(),
  // Master admin ("CRM") login. The username can be a plain handle or an email.
  adminUsername: (process.env.ADMIN_USERNAME || 'crm').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || (isProd ? null : 'crm-dev-password'),
};
