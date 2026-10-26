import { hashPassword } from './auth.js';

// Ensures the master admin ("CRM") account exists so dispatch can log in on a fresh database.
// Its password comes from ADMIN_PASSWORD and is only set when the account is first created.
export function ensureAdmin(db, username, password) {
  if (!username) return;
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(username)) return;
  if (!password) {
    console.warn('ADMIN_PASSWORD is not set, so the master admin account was not created');
    return;
  }
  db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'DeliveredAI CRM', 'admin')")
    .run(username, hashPassword(password));
  console.log(`Created master admin account "${username}"`);
}
