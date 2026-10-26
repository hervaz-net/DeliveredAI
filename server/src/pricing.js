import crypto from 'node:crypto';

// Ordered smallest to largest. A driver can take any job at or below their vehicle's size.
export const VEHICLES = {
  car:        { label: 'Car',         baseCents: 1500,  perMileCents: 175, maxLbs: 100,   desc: 'Boxes, envelopes, small parts' },
  suv:        { label: 'SUV',         baseCents: 2500,  perMileCents: 200, maxLbs: 300,   desc: 'Multiple boxes, small equipment' },
  pickup:     { label: 'Pickup Truck', baseCents: 4000, perMileCents: 250, maxLbs: 1000,  desc: 'Lumber, appliances, pallets of material' },
  cargo_van:  { label: 'Cargo Van',   baseCents: 6000,  perMileCents: 275, maxLbs: 2500,  desc: 'Large loads that need cover' },
  box_truck:  { label: 'Box Truck',   baseCents: 12000, perMileCents: 350, maxLbs: 10000, desc: 'Multiple pallets, full job-site loads' },
};
export const VEHICLE_ORDER = Object.keys(VEHICLES);
export const HELPER_FEE_CENTS = 4500;
export const SERVICE_FEE_RATE = 0.05;
export const DRIVER_SHARE = 0.75;

export function canCarry(driverVehicle, orderVehicle) {
  return VEHICLE_ORDER.indexOf(driverVehicle) >= VEHICLE_ORDER.indexOf(orderVehicle);
}

function normalize(addr) {
  return String(addr).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Without a maps API key we estimate distance deterministically from the two
// addresses, so the same route always quotes the same price. Swap this for a
// real routing call (Google Distance Matrix, Mapbox, OSRM) in production.
export function estimateDistanceMiles(pickup, dropoff) {
  const a = normalize(pickup);
  const b = normalize(dropoff);
  if (a === b) return 1;
  const key = [a, b].sort().join('|');
  const n = crypto.createHash('sha256').update(key).digest().readUInt32BE(0);
  const miles = 2 + (n % 3800) / 100; // 2.0 to 39.99 miles
  return Math.round(miles * 10) / 10;
}

export function quote({ pickup_address, dropoff_address, vehicle_type, helper }) {
  const v = VEHICLES[vehicle_type];
  if (!v) throw Object.assign(new Error('Unknown vehicle type'), { status: 400 });
  const distance = estimateDistanceMiles(pickup_address, dropoff_address);
  const mileageCents = Math.round(distance * v.perMileCents);
  const helperCents = helper ? HELPER_FEE_CENTS : 0;
  const subtotal = v.baseCents + mileageCents + helperCents;
  const serviceFeeCents = Math.round(subtotal * SERVICE_FEE_RATE);
  const totalCents = subtotal + serviceFeeCents;
  return {
    vehicle_type,
    vehicle_label: v.label,
    distance_miles: distance,
    base_cents: v.baseCents,
    mileage_cents: mileageCents,
    helper_cents: helperCents,
    service_fee_cents: serviceFeeCents,
    total_cents: totalCents,
    driver_payout_cents: Math.round(subtotal * DRIVER_SHARE),
    eta_minutes: Math.round(20 + distance * 2.2),
  };
}
