// Loads demo accounts and a few deliveries. Safe to re-run: skips if demo data exists.
import { config } from './config.js';
import { openDb, tx } from './db.js';
import { hashPassword } from './auth.js';
import { ensureAdmin } from './bootstrap.js';
import { quote } from './pricing.js';
import { addEvent, newTrackingCode } from './orders-lib.js';

const db = openDb(config.dbPath);
ensureAdmin(db, config.adminUsername, config.adminPassword);

if (db.prepare("SELECT 1 FROM users WHERE email = 'customer@demo.deliveredai.com'").get()) {
  console.log('Demo data already present');
  process.exit(0);
}

const PASSWORD = 'demo12345';
tx(db, () => {
  const add = db.prepare('INSERT INTO users (email, password_hash, name, phone, company_name, role) VALUES (?, ?, ?, ?, ?, ?)');
  const customer = add.run('customer@demo.deliveredai.com', hashPassword(PASSWORD), 'Riley Builder', '555-0100', 'Northside Construction', 'customer').lastInsertRowid;
  const driver = add.run('driver@demo.deliveredai.com', hashPassword(PASSWORD), 'Sam Rivera', '555-0142', null, 'driver').lastInsertRowid;
  db.prepare("INSERT INTO driver_profiles (user_id, vehicle_type, vehicle_make, vehicle_model, license_plate, is_online, rating) VALUES (?, 'cargo_van', 'Ford', 'Transit', 'DLV-2041', 1, 4.9)").run(driver);
  db.prepare("INSERT INTO payment_methods (user_id, brand, last4, exp_month, exp_year, is_default) VALUES (?, 'Visa', '4242', 12, ?, 1)").run(customer, new Date().getFullYear() + 3);
  const addr = db.prepare('INSERT INTO addresses (user_id, label, address, contact_name, contact_phone) VALUES (?, ?, ?, ?, ?)');
  addr.run(customer, 'Main warehouse', '1200 Industrial Pkwy, Columbus, OH', 'Dock team', '555-0110');
  addr.run(customer, 'Job site: Elm St', '48 Elm St, Columbus, OH', 'Site foreman', '555-0120');

  const make = (vehicle, item, status, driverId) => {
    const q = quote({ pickup_address: '1200 Industrial Pkwy, Columbus, OH', dropoff_address: '48 Elm St, Columbus, OH', vehicle_type: vehicle, helper: false });
    const id = db.prepare(`INSERT INTO orders (tracking_code, customer_id, driver_id, payment_method_id, status, vehicle_type, pickup_address, dropoff_address, item_description, distance_miles, price_cents, driver_payout_cents, delivered_at, proof_recipient)
      VALUES (?, ?, ?, (SELECT id FROM payment_methods WHERE user_id = ?), ?, ?, '1200 Industrial Pkwy, Columbus, OH', '48 Elm St, Columbus, OH', ?, ?, ?, ?, ?, ?)`)
      .run(newTrackingCode(), customer, driverId, customer, status, vehicle, item, q.distance_miles, q.total_cents, q.driver_payout_cents,
        status === 'delivered' ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null, status === 'delivered' ? 'Site foreman' : null).lastInsertRowid;
    addEvent(db, id, 'pending', 'Order placed');
    if (driverId) addEvent(db, id, 'assigned', 'Accepted by Sam Rivera');
    if (status === 'delivered') { addEvent(db, id, 'en_route_pickup'); addEvent(db, id, 'picked_up'); addEvent(db, id, 'delivered', 'Received by Site foreman'); }
  };
  make('pickup', '12 sheets of drywall', 'delivered', driver);
  make('cargo_van', '3 boxes of electrical fittings', 'assigned', driver);
  make('car', 'Replacement pump gasket', 'pending', null);
});

console.log(`Demo data loaded. Log in with customer@demo.deliveredai.com or driver@demo.deliveredai.com, password ${PASSWORD}`);
console.log(`Master admin login: ${config.adminUsername}`);
