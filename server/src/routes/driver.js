import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { HttpError, str } from '../validate.js';
import { canCarry, VEHICLE_ORDER } from '../pricing.js';
import { tx } from '../db.js';
import { addEvent, getEvents, findOrder, listOrders, present, DRIVER_NEXT } from '../orders-lib.js';

export default function driverRoutes(db) {
  const r = Router();
  r.use(requireAuth('driver'));

  const profile = (id) => db.prepare('SELECT * FROM driver_profiles WHERE user_id = ?').get(id);

  r.post('/status', (req, res) => {
    const online = req.body?.online ? 1 : 0;
    db.prepare('UPDATE driver_profiles SET is_online = ? WHERE user_id = ?').run(online, req.user.id);
    res.json({ online: !!online });
  });

  r.get('/jobs/available', (req, res) => {
    const p = profile(req.user.id);
    if (!p.is_online) return res.json({ jobs: [], online: false });
    const fits = VEHICLE_ORDER.filter((v) => canCarry(p.vehicle_type, v));
    const marks = fits.map(() => '?').join(',');
    const jobs = listOrders(db, `o.status = 'pending' AND o.vehicle_type IN (${marks})`, ...fits);
    // Drivers see where and what, but not customer contact details, until they accept.
    res.json({
      online: true,
      jobs: jobs.map((o) => ({
        id: o.id, tracking_code: o.tracking_code, vehicle_type: o.vehicle_type, helper: !!o.helper,
        pickup_address: o.pickup_address, dropoff_address: o.dropoff_address, item_description: o.item_description,
        weight_lbs: o.weight_lbs, scheduled_for: o.scheduled_for, distance_miles: o.distance_miles,
        driver_payout_cents: o.driver_payout_cents, created_at: o.created_at,
      })),
    });
  });

  r.get('/jobs', (req, res) => {
    res.json({ jobs: listOrders(db, 'o.driver_id = ?', req.user.id).map((o) => present(o)) });
  });

  r.get('/jobs/:id', (req, res) => {
    const o = findOrder(db, 'o.id = ? AND o.driver_id = ?', Number(req.params.id), req.user.id);
    if (!o) throw new HttpError(404, 'Job not found');
    res.json({ job: present(o, { events: getEvents(db, o.id) }) });
  });

  r.post('/jobs/:id/accept', (req, res) => {
    const p = profile(req.user.id);
    if (!p.is_online) throw new HttpError(400, 'Go online to accept jobs');
    const id = Number(req.params.id);
    const o = findOrder(db, 'o.id = ?', id);
    if (!o) throw new HttpError(404, 'Job not found');
    if (!canCarry(p.vehicle_type, o.vehicle_type)) throw new HttpError(400, 'Your vehicle is too small for this job');
    tx(db, () => {
      // Guard on status so two drivers can't both claim the same job.
      const { changes } = db.prepare("UPDATE orders SET driver_id = ?, status = 'assigned', updated_at = datetime('now') WHERE id = ? AND status = 'pending'").run(req.user.id, id);
      if (!changes) throw new HttpError(409, 'Another driver already took this job');
      addEvent(db, id, 'assigned', `Accepted by ${req.user.name}`);
    });
    const job = findOrder(db, 'o.id = ?', id);
    res.json({ job: present(job, { events: getEvents(db, id) }) });
  });

  r.post('/jobs/:id/advance', (req, res) => {
    const id = Number(req.params.id);
    const o = findOrder(db, 'o.id = ? AND o.driver_id = ?', id, req.user.id);
    if (!o) throw new HttpError(404, 'Job not found');
    const next = DRIVER_NEXT[o.status];
    if (!next) throw new HttpError(400, 'This job is already finished');
    tx(db, () => {
      if (next === 'delivered') {
        const recipient = str(req.body, 'proof_recipient', { required: true, max: 120, label: 'Recipient name' });
        const note = str(req.body, 'proof_note', { max: 500 });
        db.prepare("UPDATE orders SET status = 'delivered', proof_recipient = ?, proof_note = ?, delivered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(recipient, note, id);
        addEvent(db, id, 'delivered', `Received by ${recipient}`);
      } else {
        db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        addEvent(db, id, next, str(req.body, 'note', { max: 300 }));
      }
    });
    res.json({ job: present(findOrder(db, 'o.id = ?', id), { events: getEvents(db, id) }) });
  });

  r.get('/earnings', (req, res) => {
    const total = db.prepare("SELECT COUNT(*) AS jobs, COALESCE(SUM(driver_payout_cents),0) AS cents, COALESCE(SUM(distance_miles),0) AS miles FROM orders WHERE driver_id = ? AND status = 'delivered'").get(req.user.id);
    const week = db.prepare("SELECT COUNT(*) AS jobs, COALESCE(SUM(driver_payout_cents),0) AS cents FROM orders WHERE driver_id = ? AND status = 'delivered' AND delivered_at >= datetime('now','-7 days')").get(req.user.id);
    const daily = db.prepare("SELECT date(delivered_at) AS day, COUNT(*) AS jobs, SUM(driver_payout_cents) AS cents FROM orders WHERE driver_id = ? AND status = 'delivered' GROUP BY day ORDER BY day DESC LIMIT 14").all(req.user.id);
    res.json({ total, week, daily });
  });

  return r;
}
