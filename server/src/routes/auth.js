import { Router } from 'express';
import { hashPassword, verifyPassword, setSession, clearSession, rateLimit } from '../auth.js';
import { HttpError, str, email, password } from '../validate.js';
import { VEHICLES } from '../pricing.js';
import { tx } from '../db.js';

export function profileFor(db, user) {
  if (!user) return null;
  const out = { ...user };
  if (user.role === 'driver') {
    out.driver = db.prepare('SELECT vehicle_type, vehicle_make, vehicle_model, license_plate, is_online, rating FROM driver_profiles WHERE user_id = ?').get(user.id);
    if (out.driver) out.driver.is_online = !!out.driver.is_online;
  }
  return out;
}

export default function authRoutes(db) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 10 * 60 * 1000, max: process.env.NODE_ENV === 'test' ? 10000 : 30 });
  const getUser = db.prepare('SELECT id, email, name, phone, company_name, role, created_at FROM users WHERE id = ?');

  r.post('/signup', limiter, (req, res) => {
    const b = req.body || {};
    const role = b.role === 'driver' ? 'driver' : 'customer';
    const data = {
      name: str(b, 'name', { required: true, max: 120, label: 'Name' }),
      email: email(b),
      password: password(b),
      phone: str(b, 'phone', { required: role === 'driver', max: 40, label: 'Phone' }),
      company_name: str(b, 'company_name', { max: 160 }),
    };
    let vehicle;
    if (role === 'driver') {
      vehicle = {
        type: str(b, 'vehicle_type', { required: true, label: 'Vehicle type' }),
        make: str(b, 'vehicle_make', { max: 60 }),
        model: str(b, 'vehicle_model', { max: 60 }),
        plate: str(b, 'license_plate', { max: 20 }),
      };
      if (!VEHICLES[vehicle.type]) throw new HttpError(400, 'Choose a valid vehicle type');
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(data.email)) {
      throw new HttpError(409, 'An account with that email already exists');
    }
    const id = tx(db, () => {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO users (email, password_hash, name, phone, company_name, role) VALUES (?, ?, ?, ?, ?, ?)')
        .run(data.email, hashPassword(data.password), data.name, data.phone, data.company_name, role);
      if (vehicle) {
        db.prepare('INSERT INTO driver_profiles (user_id, vehicle_type, vehicle_make, vehicle_model, license_plate) VALUES (?, ?, ?, ?, ?)')
          .run(lastInsertRowid, vehicle.type, vehicle.make, vehicle.model, vehicle.plate);
      }
      return lastInsertRowid;
    });
    const user = getUser.get(id);
    setSession(res, user);
    res.status(201).json({ user: profileFor(db, user) });
  });

  r.post('/login', limiter, (req, res) => {
    const addr = String(req.body?.email || '').trim().toLowerCase();
    const pw = String(req.body?.password || '');
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(addr);
    if (!row || !verifyPassword(pw, row.password_hash)) throw new HttpError(401, 'Email or password is incorrect');
    const user = getUser.get(row.id);
    setSession(res, user);
    res.json({ user: profileFor(db, user) });
  });

  r.post('/logout', (_req, res) => {
    clearSession(res);
    res.json({ ok: true });
  });

  r.get('/me', (req, res) => {
    res.json({ user: profileFor(db, req.user) });
  });

  return r;
}
