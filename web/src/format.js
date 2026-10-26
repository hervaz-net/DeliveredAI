export const money = (cents) =>
  (Number(cents || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// SQLite returns "YYYY-MM-DD HH:MM:SS" in UTC; ISO strings pass through.
export function parseDate(s) {
  if (!s) return null;
  return new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
}

export const dateTime = (s) =>
  s ? parseDate(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export const VEHICLE_LABELS = {
  car: 'Car',
  suv: 'SUV',
  pickup: 'Pickup Truck',
  cargo_van: 'Cargo Van',
  box_truck: 'Box Truck',
};
