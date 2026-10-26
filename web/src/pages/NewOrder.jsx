import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { Alert, Field } from '../components/ui.jsx';
import { useVehicles, useQuote, QuoteBreakdown, VehiclePicker } from '../components/QuoteForm.jsx';
import { money } from '../format.js';

const blank = {
  pickup_address: '', pickup_contact_name: '', pickup_contact_phone: '', pickup_notes: '',
  dropoff_address: '', dropoff_contact_name: '', dropoff_contact_phone: '', dropoff_notes: '',
  vehicle_type: 'car', helper: false, item_description: '', weight_lbs: '',
  when: 'now', scheduled_for: '', payment_method_id: '',
};

function loadDraft() {
  try {
    const d = JSON.parse(sessionStorage.getItem('dai_draft') || 'null');
    sessionStorage.removeItem('dai_draft');
    return d ? { ...blank, ...d } : blank;
  } catch {
    return blank;
  }
}

export default function NewOrder() {
  const navigate = useNavigate();
  const { vehicles, helper_fee_cents } = useVehicles();
  const [f, setF] = useState(loadDraft);
  const { quote, error: quoteError } = useQuote(f);
  const addresses = useApi('/account/addresses').data?.addresses || [];
  const cardsRes = useApi('/account/payment-methods');
  const cards = cardsRes.data?.payment_methods || [];
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (cards.length && !f.payment_method_id) setF((prev) => ({ ...prev, payment_method_id: String(cards[0].id) }));
  }, [cards, f.payment_method_id]);

  const useSaved = (side) => (e) => {
    const a = addresses.find((x) => String(x.id) === e.target.value);
    if (!a) return;
    setF({ ...f, [`${side}_address`]: a.address, [`${side}_contact_name`]: a.contact_name || '', [`${side}_contact_phone`]: a.contact_phone || '' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...f, scheduled_for: f.when === 'later' && f.scheduled_for ? new Date(f.scheduled_for).toISOString() : null };
      const { order } = await api('/orders', { method: 'POST', body });
      navigate(`/app/orders/${order.id}`);
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  const Stop = ({ side, title }) => (
    <fieldset className="card">
      <legend>{title}</legend>
      {addresses.length > 0 && (
        <Field label="Use a saved address">
          <select defaultValue="" onChange={useSaved(side)}>
            <option value="">Choose…</option>
            {addresses.map((a) => <option key={a.id} value={a.id}>{a.label}: {a.address}</option>)}
          </select>
        </Field>
      )}
      <Field label="Address"><input required value={f[`${side}_address`]} onChange={set(`${side}_address`)} placeholder="Street, city, state" /></Field>
      <div className="grid-2">
        <Field label="Contact name"><input value={f[`${side}_contact_name`]} onChange={set(`${side}_contact_name`)} /></Field>
        <Field label="Contact phone"><input type="tel" value={f[`${side}_contact_phone`]} onChange={set(`${side}_contact_phone`)} /></Field>
      </div>
      <Field label="Notes for the driver"><input value={f[`${side}_notes`]} onChange={set(`${side}_notes`)} placeholder="Gate code, dock number, ask for…" /></Field>
    </fieldset>
  );

  return (
    <div className="container page">
      <h1>New delivery</h1>
      <Alert>{error}</Alert>
      <form className="order-layout" onSubmit={submit}>
        <div className="order-main">
          {/* Called as functions so inputs keep focus across re-renders */}
          {Stop({ side: 'pickup', title: 'Pickup' })}
          {Stop({ side: 'dropoff', title: 'Drop-off' })}
          <fieldset className="card">
            <legend>What are we moving?</legend>
            <Field label="Description"><input required value={f.item_description} onChange={set('item_description')} placeholder="e.g. 4 boxes of tile, 1 water heater" /></Field>
            <Field label="Approximate weight (lbs)"><input type="number" min="0" value={f.weight_lbs} onChange={set('weight_lbs')} /></Field>
            <span className="field-label">Vehicle</span>
            <VehiclePicker vehicles={vehicles} value={f.vehicle_type} onChange={(v) => setF({ ...f, vehicle_type: v })} />
            <label className="check">
              <input type="checkbox" checked={f.helper} onChange={(e) => setF({ ...f, helper: e.target.checked })} />
              Add a second helper for loading (+{money(helper_fee_cents)})
            </label>
          </fieldset>
          <fieldset className="card">
            <legend>When</legend>
            <div className="seg">
              <label className={f.when === 'now' ? 'on' : ''}><input type="radio" name="when" value="now" checked={f.when === 'now'} onChange={set('when')} />As soon as possible</label>
              <label className={f.when === 'later' ? 'on' : ''}><input type="radio" name="when" value="later" checked={f.when === 'later'} onChange={set('when')} />Schedule</label>
            </div>
            {f.when === 'later' && (
              <Field label="Pickup time"><input type="datetime-local" required value={f.scheduled_for} onChange={set('scheduled_for')} /></Field>
            )}
          </fieldset>
        </div>
        <aside className="order-side">
          <div className="card sticky">
            <h2>Your price</h2>
            <Alert>{quoteError}</Alert>
            <QuoteBreakdown quote={quote} />
            <Field label="Pay with">
              {cards.length ? (
                <select value={f.payment_method_id} onChange={set('payment_method_id')}>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.brand} ending {c.last4}</option>)}
                </select>
              ) : (
                <p className="muted">No card on file. <Link to="/account?tab=billing">Add one in Account</Link>.</p>
              )}
            </Field>
            <button className="btn btn-primary btn-block" disabled={busy || !quote || !cards.length}>
              {busy ? 'Booking…' : quote ? `Book for ${money(quote.total_cents)}` : 'Book delivery'}
            </button>
            <p className="muted small">You're charged when the delivery is completed.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
