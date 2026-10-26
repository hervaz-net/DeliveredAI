import { Router } from 'express';
import { requireAuth, hashPassword, verifyPassword } from '../auth.js';
import { HttpError, str, email, password, luhnValid, cardBrand } from '../validate.js';
import { VEHICLES } from '../pricing.js';
import { tx } from '../db.js';
import { profileFor } from './auth.js';

export default function accountRoutes(db) {
  const r = Router();
  r.use(requireAuth());

  r.patch('/', (req, res) => {
    const b = req.body || {};
    const next = {
      name: str(b, 'name', { required: true, max: 120, label: 'Name' }),
      // The master admin signs in with a handle such as "crm", not an email address.
      email: req.user.role === 'admin' ? str(b, 'email', { required: true, max: 254, label: 'Login' }).toLowerCase() : email(b),
      phone: str(b, 'phone', { max: 40 }),
      company_name: str(b, 'company_name', { max: 160 }),
    };
    const clash = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(next.email, req.user.id);
    if (clash) throw new HttpError(409, 'That email is already in use');
    db.prepare('UPDATE users SET name = ?, email = ?, phone = ?, company_name = ? WHERE id = ?')
      .run(next.name, next.email, next.phone, next.company_name, req.user.id);
    const user = db.prepare('SELECT id, email, name, phone, company_name, role, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: profileFor(db, user) });
  });

  r.post('/password', (req, res) => {
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!verifyPassword(String(req.body?.current_password || ''), row.password_hash)) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    const pw = password(req.body, 'new_password');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(pw), req.user.id);
    res.json({ ok: true });
  });

  r.delete('/', (req, res) => {
    if (req.user.role === 'admin') throw new HttpError(400, 'Admin accounts cannot be deleted here');
    const active = db.prepare("SELECT 1 FROM orders WHERE (customer_id = ? OR driver_id = ?) AND status NOT IN ('delivered','cancelled')").get(req.user.id, req.user.id);
    if (active) throw new HttpError(400, 'Finish or cancel your active deliveries before closing your account');
    tx(db, () => {
      const anon = `deleted-${req.user.id}-${Date.now()}@deleted.invalid`;
      // Keep order history intact for the other party, but scrub personal data.
      db.prepare("UPDATE users SET email = ?, name = 'Deleted user', phone = NULL, company_name = NULL, password_hash = 'disabled' WHERE id = ?").run(anon, req.user.id);
      db.prepare('DELETE FROM addresses WHERE user_id = ?').run(req.user.id);
      db.prepare('DELETE FROM payment_methods WHERE user_id = ?').run(req.user.id);
      db.prepare('UPDATE driver_profiles SET is_online = 0 WHERE user_id = ?').run(req.user.id);
    });
    res.clearCookie('dai_session', { path: '/' });
    res.json({ ok: true });
  });

  // Driver vehicle details
  r.patch('/vehicle', requireAuth('driver'), (req, res) => {
    const b = req.body || {};
    const type = str(b, 'vehicle_type', { required: true, label: 'Vehicle type' });
    if (!VEHICLES[type]) throw new HttpError(400, 'Choose a valid vehicle type');
    db.prepare('UPDATE driver_profiles SET vehicle_type = ?, vehicle_make = ?, vehicle_model = ?, license_plate = ? WHERE user_id = ?')
      .run(type, str(b, 'vehicle_make', { max: 60 }), str(b, 'vehicle_model', { max: 60 }), str(b, 'license_plate', { max: 20 }), req.user.id);
    res.json({ user: profileFor(db, req.user) });
  });

  // Saved addresses
  r.get('/addresses', (req, res) => {
    res.json({ addresses: db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY label').all(req.user.id) });
  });

  r.post('/addresses', (req, res) => {
    const b = req.body || {};
    const { lastInsertRowid } = db
      .prepare('INSERT INTO addresses (user_id, label, address, contact_name, contact_phone) VALUES (?, ?, ?, ?, ?)')
      .run(
        req.user.id,
        str(b, 'label', { required: true, max: 60, label: 'Label' }),
        str(b, 'address', { required: true, max: 300, label: 'Address' }),
        str(b, 'contact_name', { max: 120 }),
        str(b, 'contact_phone', { max: 40 }),
      );
    res.status(201).json({ address: db.prepare('SELECT * FROM addresses WHERE id = ?').get(lastInsertRowid) });
  });

  r.delete('/addresses/:id', (req, res) => {
    const { changes } = db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
    if (!changes) throw new HttpError(404, 'Address not found');
    res.json({ ok: true });
  });

  // Payment methods. Only brand and last 4 digits are stored; a real deployment
  // would hand the card to a processor (e.g. Stripe) and store its token instead.
  r.get('/payment-methods', (req, res) => {
    res.json({ payment_methods: db.prepare('SELECT id, brand, last4, exp_month, exp_year, is_default FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, id').all(req.user.id) });
  });

  r.post('/payment-methods', requireAuth('customer'), (req, res) => {
    const num = String(req.body?.card_number || '').replace(/\D/g, '');
    const month = Number(req.body?.exp_month);
    const year = Number(req.body?.exp_year);
    if (!luhnValid(num)) throw new HttpError(400, 'Card number is not valid');
    if (!(month >= 1 && month <= 12)) throw new HttpError(400, 'Expiry month is not valid');
    const now = new Date();
    const fullYear = year < 100 ? 2000 + year : year;
    if (!(fullYear >= now.getFullYear() && fullYear < now.getFullYear() + 25) || (fullYear === now.getFullYear() && month < now.getMonth() + 1)) {
      throw new HttpError(400, 'Card is expired');
    }
    const id = tx(db, () => {
      const hasAny = db.prepare('SELECT 1 FROM payment_methods WHERE user_id = ?').get(req.user.id);
      return db.prepare('INSERT INTO payment_methods (user_id, brand, last4, exp_month, exp_year, is_default) VALUES (?, ?, ?, ?, ?, ?)')
        .run(req.user.id, cardBrand(num), num.slice(-4), month, fullYear, hasAny ? 0 : 1).lastInsertRowid;
    });
    res.status(201).json({ payment_method: db.prepare('SELECT id, brand, last4, exp_month, exp_year, is_default FROM payment_methods WHERE id = ?').get(id) });
  });

  r.post('/payment-methods/:id/default', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM payment_methods WHERE id = ? AND user_id = ?').get(id, req.user.id)) throw new HttpError(404, 'Card not found');
    tx(db, () => {
      db.prepare('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?').run(req.user.id);
      db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(id);
    });
    res.json({ ok: true });
  });

  r.delete('/payment-methods/:id', (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT is_default FROM payment_methods WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!row) throw new HttpError(404, 'Card not found');
    tx(db, () => {
      db.prepare('UPDATE orders SET payment_method_id = NULL WHERE payment_method_id = ?').run(id);
      db.prepare('DELETE FROM payment_methods WHERE id = ?').run(id);
      if (row.is_default) {
        db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = (SELECT id FROM payment_methods WHERE user_id = ? ORDER BY id LIMIT 1)').run(req.user.id);
      }
    });
    res.json({ ok: true });
  });

  return r;
}
