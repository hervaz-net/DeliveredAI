import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useVehicles, useQuote, QuoteBreakdown, VehiclePicker, VehicleIcon } from '../components/QuoteForm.jsx';
import { money } from '../format.js';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { vehicles, helper_fee_cents } = useVehicles();
  const [form, setForm] = useState({ pickup_address: '', dropoff_address: '', vehicle_type: 'pickup', helper: false });
  const { quote } = useQuote(form);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const book = () => {
    sessionStorage.setItem('dai_draft', JSON.stringify(form));
    navigate(user?.role === 'customer' ? '/app/new' : '/signup');
  };

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Same-day business delivery</p>
            <h1>The part you need, at the job site, today.</h1>
            <p className="lead">
              DeliveredAI connects your business with vetted local drivers in cars, pickups, cargo vans and box trucks.
              Book in under a minute, track every mile, and keep your crew working.
            </p>
            <div className="hero-cta">
              <Link to="/signup" className="btn btn-accent">Create a business account</Link>
              <Link to="/track" className="btn btn-ghost-light">Track a delivery</Link>
            </div>
            <ul className="hero-stats">
              <li><strong>~45 min</strong><span>average pickup</span></li>
              <li><strong>5</strong><span>vehicle sizes</span></li>
              <li><strong>24/7</strong><span>booking</span></li>
            </ul>
          </div>
          <div className="card quote-card">
            <h2>Get an instant quote</h2>
            <label className="field">
              <span className="field-label">Pickup address</span>
              <input value={form.pickup_address} onChange={set('pickup_address')} placeholder="Supplier, warehouse or store" />
            </label>
            <label className="field">
              <span className="field-label">Drop-off address</span>
              <input value={form.dropoff_address} onChange={set('dropoff_address')} placeholder="Job site or customer" />
            </label>
            <VehiclePicker vehicles={vehicles} value={form.vehicle_type} onChange={(v) => setForm({ ...form, vehicle_type: v })} />
            <label className="check">
              <input type="checkbox" checked={form.helper} onChange={(e) => setForm({ ...form, helper: e.target.checked })} />
              Add a second helper for heavy items (+{money(helper_fee_cents)})
            </label>
            <QuoteBreakdown quote={quote} />
            <button className="btn btn-primary btn-block" onClick={book} disabled={!quote}>
              {user?.role === 'customer' ? 'Book this delivery' : 'Sign up to book'}
            </button>
          </div>
        </div>
      </section>

      <section className="section" id="vehicles">
        <div className="container">
          <h2 className="section-title">A vehicle for every load</h2>
          <p className="section-sub">Upfront pricing: a base fare for the vehicle, plus mileage. No surge pricing, ever.</p>
          <div className="vehicle-grid">
            {vehicles.map((v) => (
              <div className="card vehicle-card" key={v.id}>
                <VehicleIcon type={v.id} />
                <h3>{v.label}</h3>
                <p className="muted">{v.desc}</p>
                <p className="price">from {money(v.baseCents)} <small>+ {money(v.perMileCents)}/mi</small></p>
                <p className="muted small">Up to {v.maxLbs.toLocaleString()} lbs</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="how">
        <div className="container">
          <h2 className="section-title">How it works</h2>
          <div className="steps-grid">
            <div><span className="num">1</span><h3>Book</h3><p>Enter pickup and drop-off, choose a vehicle, and see your price before you commit.</p></div>
            <div><span className="num">2</span><h3>Match</h3><p>The nearest qualified driver accepts your job. You get their name, vehicle and plate.</p></div>
            <div><span className="num">3</span><h3>Track</h3><p>Follow every step live and share a tracking link with whoever is receiving it.</p></div>
            <div><span className="num">4</span><h3>Confirm</h3><p>Get proof of delivery with the recipient's name and driver notes, on every order.</p></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <h2 className="section-title">Built for the trades</h2>
            <ul className="ticks">
              <li>Construction, HVAC, plumbing, electrical and industrial supply</li>
              <li>Schedule ahead or send it right now</li>
              <li>Saved pickup locations for your branches and suppliers</li>
              <li>One account for your whole team, one card on file</li>
            </ul>
          </div>
          <div className="card cta-card">
            <h3>Have a vehicle? Earn on your schedule.</h3>
            <p className="muted">Drivers keep 75% of every fare. Go online when it suits you and pick the jobs you want.</p>
            <Link to="/drivers" className="btn btn-primary">Apply to drive</Link>
          </div>
        </div>
      </section>
    </>
  );
}
