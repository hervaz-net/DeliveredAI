import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { money } from '../format.js';

// Live price estimate used on the landing page and the booking form.
export function useVehicles() {
  const [data, setData] = useState({ vehicles: [], helper_fee_cents: 0 });
  useEffect(() => {
    api('/vehicles').then(setData).catch(() => {});
  }, []);
  return data;
}

export function useQuote({ pickup_address, dropoff_address, vehicle_type, helper }) {
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!pickup_address?.trim() || !dropoff_address?.trim() || !vehicle_type) {
      setQuote(null);
      return;
    }
    const t = setTimeout(() => {
      api('/quotes', { method: 'POST', body: { pickup_address, dropoff_address, vehicle_type, helper } })
        .then((d) => { setQuote(d.quote); setError(''); })
        .catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [pickup_address, dropoff_address, vehicle_type, helper]);
  return { quote, error };
}

export function QuoteBreakdown({ quote }) {
  if (!quote) return <p className="muted">Enter both addresses to see your price.</p>;
  return (
    <div className="quote">
      <div className="quote-total">
        <span>{money(quote.total_cents)}</span>
        <small>{quote.distance_miles} mi · about {quote.eta_minutes} min</small>
      </div>
      <dl className="quote-lines">
        <dt>{quote.vehicle_label} base</dt><dd>{money(quote.base_cents)}</dd>
        <dt>Mileage</dt><dd>{money(quote.mileage_cents)}</dd>
        {quote.helper_cents > 0 && (<><dt>Second helper</dt><dd>{money(quote.helper_cents)}</dd></>)}
        <dt>Service fee</dt><dd>{money(quote.service_fee_cents)}</dd>
      </dl>
    </div>
  );
}

export function VehiclePicker({ vehicles, value, onChange }) {
  return (
    <div className="vehicle-picker" role="radiogroup" aria-label="Vehicle">
      {vehicles.map((v) => (
        <button
          type="button"
          key={v.id}
          role="radio"
          aria-checked={value === v.id}
          className={`vehicle-opt ${value === v.id ? 'selected' : ''}`}
          onClick={() => onChange(v.id)}
        >
          <VehicleIcon type={v.id} />
          <strong>{v.label}</strong>
          <small>up to {v.maxLbs.toLocaleString()} lbs</small>
        </button>
      ))}
    </div>
  );
}

export function VehicleIcon({ type }) {
  const w = { car: 34, suv: 38, pickup: 44, cargo_van: 46, box_truck: 52 }[type] || 40;
  return (
    <svg className="vehicle-icon" viewBox="0 0 56 28" width={w} height="24" aria-hidden="true">
      {type === 'box_truck' ? (
        <path d="M2 4h32v16H2zM34 10h10l8 6v4H34z" />
      ) : type === 'cargo_van' ? (
        <path d="M4 6h30l10 6h6v8H4z" />
      ) : type === 'pickup' ? (
        <path d="M2 12h22V6h12l8 6h8v8H2z" />
      ) : type === 'suv' ? (
        <path d="M6 8h28l8 4h8v8H4v-8z" />
      ) : (
        <path d="M8 12l6-6h18l8 6h8v8H6v-8z" />
      )}
      <circle cx="14" cy="21" r="4" />
      <circle cx="42" cy="21" r="4" />
    </svg>
  );
}
