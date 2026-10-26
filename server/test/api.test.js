import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { openDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { ensureAdmin } = await import('../src/bootstrap.js');

let server;
let base;

before(async () => {
  const db = openDb(':memory:');
  ensureAdmin(db, 'crm', 'adminpass1');
  server = createApp(db, { serveWeb: false }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

// Minimal client that keeps its own session cookie.
function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
}

const customer = client();
const driver = client();
const smallDriver = client();
const admin = client();
const anon = client();
let orderId;
let trackingCode;

test('public quote prices by vehicle and distance', async () => {
  const r = await anon('POST', '/quotes', { pickup_address: '1 A St', dropoff_address: '9 B Ave', vehicle_type: 'pickup', helper: true });
  assert.equal(r.status, 200);
  assert.ok(r.body.quote.total_cents > 4000 + 4500);
  const again = await anon('POST', '/quotes', { pickup_address: '9 b ave', dropoff_address: '1 a st', vehicle_type: 'pickup', helper: true });
  assert.equal(again.body.quote.total_cents, r.body.quote.total_cents, 'quotes are stable for the same route');
  assert.equal((await anon('POST', '/quotes', { pickup_address: 'x', dropoff_address: 'y', vehicle_type: 'rocket' })).status, 400);
});

test('signup, login, logout and me', async () => {
  let r = await customer('POST', '/auth/signup', { name: 'Casey', email: 'Casey@Example.com', password: 'password1', company_name: 'Acme' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.email, 'casey@example.com');
  assert.equal(r.body.user.role, 'customer');
  assert.equal(r.body.user.password_hash, undefined);

  assert.equal((await anon('POST', '/auth/signup', { name: 'X', email: 'casey@example.com', password: 'password1' })).status, 409);
  assert.equal((await anon('POST', '/auth/signup', { name: 'X', email: 'short@example.com', password: 'short' })).status, 400);
  assert.equal((await anon('POST', '/auth/login', { email: 'casey@example.com', password: 'wrongpass' })).status, 401);

  r = await customer('POST', '/auth/logout');
  assert.equal((await customer('GET', '/auth/me')).body.user, null);
  r = await customer('POST', '/auth/login', { email: 'casey@example.com', password: 'password1' });
  assert.equal(r.status, 200);
  assert.equal((await customer('GET', '/auth/me')).body.user.name, 'Casey');

  r = await driver('POST', '/auth/signup', { role: 'driver', name: 'Dana Drive', email: 'dana@example.com', password: 'password1', phone: '555', vehicle_type: 'cargo_van' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.driver.vehicle_type, 'cargo_van');
  await smallDriver('POST', '/auth/signup', { role: 'driver', name: 'Sid Small', email: 'sid@example.com', password: 'password1', phone: '555', vehicle_type: 'car' });
  assert.equal((await admin('POST', '/auth/login', { email: 'CRM', password: 'adminpass1' })).status, 200);
});

test('account pages: profile, password, addresses, cards', async () => {
  let r = await customer('PATCH', '/account', { name: 'Casey Jones', email: 'casey@example.com', phone: '555-1', company_name: 'Acme Co' });
  assert.equal(r.body.user.company_name, 'Acme Co');
  assert.equal((await customer('POST', '/account/password', { current_password: 'nope', new_password: 'newpassword' })).status, 400);
  assert.equal((await customer('POST', '/account/password', { current_password: 'password1', new_password: 'newpassword' })).status, 200);
  assert.equal((await anon('POST', '/auth/login', { email: 'casey@example.com', password: 'newpassword' })).status, 200);

  r = await customer('POST', '/account/addresses', { label: 'Shop', address: '1 A St' });
  assert.equal(r.status, 201);
  assert.equal((await customer('GET', '/account/addresses')).body.addresses.length, 1);

  assert.equal((await customer('POST', '/account/payment-methods', { card_number: '4242424242424241', exp_month: 1, exp_year: 2099 })).status, 400);
  r = await customer('POST', '/account/payment-methods', { card_number: '4242 4242 4242 4242', exp_month: 12, exp_year: new Date().getFullYear() + 2 });
  assert.equal(r.status, 201);
  assert.equal(r.body.payment_method.last4, '4242');
  assert.equal(r.body.payment_method.is_default, 1);
});

test('customer books, driver delivers, anyone can track', async () => {
  assert.equal((await driver('POST', '/orders', {})).status, 403);
  let r = await customer('POST', '/orders', {
    pickup_address: '1 A St', dropoff_address: '9 B Ave', vehicle_type: 'suv', item_description: 'Tile boxes', weight_lbs: 120,
    dropoff_contact_name: 'Pat', dropoff_contact_phone: '555-9',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.order.status, 'pending');
  orderId = r.body.order.id;
  trackingCode = r.body.order.tracking_code;

  // Driver must be online; car is too small for an SUV job.
  assert.equal((await driver('GET', '/driver/jobs/available')).body.jobs.length, 0);
  await driver('POST', '/driver/status', { online: true });
  await smallDriver('POST', '/driver/status', { online: true });
  const feed = (await driver('GET', '/driver/jobs/available')).body.jobs;
  assert.equal(feed.length, 1);
  assert.equal(feed[0].dropoff_contact_phone, undefined, 'contact details hidden before accept');
  assert.equal((await smallDriver('GET', '/driver/jobs/available')).body.jobs.length, 0);
  assert.equal((await smallDriver('POST', `/driver/jobs/${orderId}/accept`)).status, 400);

  assert.equal((await driver('POST', `/driver/jobs/${orderId}/accept`)).status, 200);
  assert.equal((await driver('POST', `/driver/jobs/${orderId}/accept`)).status, 409);
  assert.equal((await driver('POST', `/driver/jobs/${orderId}/advance`)).body.job.status, 'en_route_pickup');
  assert.equal((await driver('POST', `/driver/jobs/${orderId}/advance`)).body.job.status, 'picked_up');
  assert.equal((await driver('POST', `/driver/jobs/${orderId}/advance`, {})).status, 400, 'recipient name required');
  r = await driver('POST', `/driver/jobs/${orderId}/advance`, { proof_recipient: 'Pat', proof_note: 'Left at back door' });
  assert.equal(r.body.job.status, 'delivered');

  r = await anon('GET', `/track/${trackingCode.toLowerCase()}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.order.status, 'delivered');
  assert.deepEqual(r.body.order.events.map((e) => e.status), ['pending', 'assigned', 'en_route_pickup', 'picked_up', 'delivered']);
  assert.equal(r.body.order.customer_email, undefined);

  r = await driver('GET', '/driver/earnings');
  assert.equal(r.body.total.jobs, 1);
  assert.ok(r.body.total.cents > 0);

  assert.equal((await customer('POST', `/orders/${orderId}/cancel`)).status, 400, 'cannot cancel delivered');
});

test('customers only see their own orders', async () => {
  const other = client();
  await other('POST', '/auth/signup', { name: 'Other', email: 'other@example.com', password: 'password1' });
  assert.equal((await other('GET', `/orders/${orderId}`)).status, 404);
  assert.equal((await other('GET', '/orders')).body.orders.length, 0);
  assert.equal((await other('POST', '/orders', { pickup_address: 'a', dropoff_address: 'b', vehicle_type: 'car', item_description: 'x' })).status, 400, 'needs a card');
});

test('admin dispatch: stats, assign and cancel', async () => {
  assert.equal((await customer('GET', '/admin/stats')).status, 403);
  const r = await customer('POST', '/orders', { pickup_address: '5 C St', dropoff_address: '7 D St', vehicle_type: 'box_truck', item_description: 'Pallets' });
  const id = r.body.order.id;
  const drivers = (await admin('GET', '/admin/drivers')).body.drivers;
  const dana = drivers.find((d) => d.email === 'dana@example.com');
  assert.equal((await admin('POST', `/admin/orders/${id}/assign`, { driver_id: dana.id })).status, 400, 'van too small for box truck');

  const r2 = await customer('POST', '/orders', { pickup_address: '5 C St', dropoff_address: '7 D St', vehicle_type: 'car', item_description: 'Envelope' });
  const a = await admin('POST', `/admin/orders/${r2.body.order.id}/assign`, { driver_id: dana.id });
  assert.equal(a.body.order.status, 'assigned');
  assert.equal(a.body.order.driver_name, 'Dana Drive');

  assert.equal((await customer('POST', `/orders/${id}/cancel`)).body.order.status, 'cancelled');
  const stats = (await admin('GET', '/admin/stats')).body;
  assert.equal(stats.orders_total, 3);
  assert.equal(stats.drivers, 2);
});

test('master admin CRM sees signups, quotes, API activity and exports', async () => {
  const signups = (await admin('GET', '/admin/signups')).body.users;
  assert.ok(signups.some((u) => u.role === 'driver') && signups.some((u) => u.role === 'customer'));
  assert.ok(signups.every((u) => u.password_hash === undefined));

  const quotes = (await admin('GET', '/admin/quotes')).body.quotes;
  assert.ok(quotes.length >= 2);
  const stats = (await admin('GET', '/admin/stats')).body;
  assert.ok(stats.quotes_total >= 2);
  assert.ok(stats.api_calls_24h > 10);

  const logs = (await admin('GET', '/admin/api-logs?errors=1')).body.logs;
  assert.ok(logs.length > 0 && logs.every((l) => l.status >= 400));

  const res = await fetch(`${base}/admin/export/users`, { headers: { cookie: '' } });
  assert.equal(res.status, 401);
  assert.equal((await customer('GET', '/admin/api-logs')).status, 403);
});
