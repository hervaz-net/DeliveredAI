import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert, Field } from '../components/ui.jsx';
import { useVehicles, VehiclePicker } from '../components/QuoteForm.jsx';

export default function DriverSignup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const { vehicles } = useVehicles();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', vehicle_type: 'car', vehicle_make: '', vehicle_model: '', license_plate: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signup({ ...f, role: 'driver' });
      navigate('/driver', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card wide" onSubmit={submit}>
        <p className="eyebrow dark">Drive with DeliveredAI</p>
        <h1>Earn with the vehicle you already have</h1>
        <p className="muted">Keep 75% of every fare. Choose your hours and your jobs.</p>
        <Alert>{error}</Alert>
        <div className="grid-2">
          <Field label="Full name"><input required autoComplete="name" value={f.name} onChange={set('name')} /></Field>
          <Field label="Mobile phone"><input type="tel" required autoComplete="tel" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Email"><input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Password" hint="At least 8 characters">
            <input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} />
          </Field>
        </div>
        <span className="field-label">Your vehicle</span>
        <VehiclePicker vehicles={vehicles} value={f.vehicle_type} onChange={(v) => setF({ ...f, vehicle_type: v })} />
        <div className="grid-3">
          <Field label="Make"><input value={f.vehicle_make} onChange={set('vehicle_make')} placeholder="Ford" /></Field>
          <Field label="Model"><input value={f.vehicle_model} onChange={set('vehicle_model')} placeholder="F-150" /></Field>
          <Field label="License plate"><input value={f.license_plate} onChange={set('license_plate')} /></Field>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Submitting…' : 'Create driver account'}</button>
        <p className="auth-alt">Already driving with us? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
