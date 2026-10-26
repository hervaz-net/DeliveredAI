import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { Alert, Field } from '../components/ui.jsx';
import { useVehicles, VehiclePicker } from '../components/QuoteForm.jsx';

function useSubmit(fn) {
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const [busy, setBusy] = useState(false);
  const run = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setMsg({ ok: '', err: '' });
    try {
      const ok = await fn();
      setMsg({ ok: ok || 'Saved', err: '' });
    } catch (err) {
      setMsg({ ok: '', err: err.message });
    } finally {
      setBusy(false);
    }
  };
  return { run, busy, msg };
}

function Profile() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user.name, email: user.email, phone: user.phone || '', company_name: user.company_name || '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const s = useSubmit(async () => { setUser((await api('/account', { method: 'PATCH', body: f })).user); return 'Profile updated'; });
  return (
    <form className="card" onSubmit={s.run}>
      <h2>Profile</h2>
      <Alert>{s.msg.err}</Alert><Alert kind="ok">{s.msg.ok}</Alert>
      <div className="grid-2">
        <Field label="Name"><input required value={f.name} onChange={set('name')} /></Field>
        <Field label={user.role === 'admin' ? 'Login' : 'Email'}><input type={user.role === 'admin' ? 'text' : 'email'} required value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone"><input type="tel" value={f.phone} onChange={set('phone')} /></Field>
        {user.role === 'customer' && <Field label="Company"><input value={f.company_name} onChange={set('company_name')} /></Field>}
      </div>
      <button className="btn btn-primary" disabled={s.busy}>Save profile</button>
    </form>
  );
}

function Password() {
  const [f, setF] = useState({ current_password: '', new_password: '', confirm: '' });
  const s = useSubmit(async () => {
    if (f.new_password !== f.confirm) throw new Error('New passwords do not match');
    await api('/account/password', { method: 'POST', body: f });
    setF({ current_password: '', new_password: '', confirm: '' });
    return 'Password changed';
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card" onSubmit={s.run}>
      <h2>Password</h2>
      <Alert>{s.msg.err}</Alert><Alert kind="ok">{s.msg.ok}</Alert>
      <Field label="Current password"><input type="password" required autoComplete="current-password" value={f.current_password} onChange={set('current_password')} /></Field>
      <div className="grid-2">
        <Field label="New password" hint="At least 8 characters"><input type="password" required minLength={8} autoComplete="new-password" value={f.new_password} onChange={set('new_password')} /></Field>
        <Field label="Confirm new password"><input type="password" required autoComplete="new-password" value={f.confirm} onChange={set('confirm')} /></Field>
      </div>
      <button className="btn btn-primary" disabled={s.busy}>Change password</button>
    </form>
  );
}

function Addresses() {
  const { data, reload } = useApi('/account/addresses');
  const blank = { label: '', address: '', contact_name: '', contact_phone: '' };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const s = useSubmit(async () => { await api('/account/addresses', { method: 'POST', body: f }); setF(blank); await reload(); return 'Address saved'; });
  const remove = async (id) => { await api(`/account/addresses/${id}`, { method: 'DELETE' }); reload(); };
  return (
    <div className="card">
      <h2>Saved addresses</h2>
      <p className="muted">Save your branches, suppliers and regular job sites to book faster.</p>
      <ul className="list">
        {(data?.addresses || []).map((a) => (
          <li key={a.id}>
            <div><strong>{a.label}</strong><div className="muted small">{a.address}{a.contact_name ? ` · ${a.contact_name}` : ''}</div></div>
            <button className="link-btn danger" onClick={() => remove(a.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <form onSubmit={s.run}>
        <Alert>{s.msg.err}</Alert>
        <div className="grid-2">
          <Field label="Label"><input required value={f.label} onChange={set('label')} placeholder="Main warehouse" /></Field>
          <Field label="Address"><input required value={f.address} onChange={set('address')} /></Field>
          <Field label="Contact name"><input value={f.contact_name} onChange={set('contact_name')} /></Field>
          <Field label="Contact phone"><input value={f.contact_phone} onChange={set('contact_phone')} /></Field>
        </div>
        <button className="btn btn-ghost" disabled={s.busy}>Add address</button>
      </form>
    </div>
  );
}

function Billing() {
  const { data, reload } = useApi('/account/payment-methods');
  const blank = { card_number: '', exp_month: '', exp_year: '', cvc: '' };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const s = useSubmit(async () => {
    await api('/account/payment-methods', { method: 'POST', body: { card_number: f.card_number, exp_month: f.exp_month, exp_year: f.exp_year } });
    setF(blank);
    await reload();
    return 'Card added';
  });
  const act = async (path, method) => { await api(path, { method }); reload(); };
  return (
    <div className="card">
      <h2>Payment methods</h2>
      <ul className="list">
        {(data?.payment_methods || []).map((c) => (
          <li key={c.id}>
            <div><strong>{c.brand} •••• {c.last4}</strong> <span className="muted small">exp {String(c.exp_month).padStart(2, '0')}/{c.exp_year}</span>
              {c.is_default ? <span className="badge badge-assigned">Default</span> : null}</div>
            <div className="row">
              {!c.is_default && <button className="link-btn" onClick={() => act(`/account/payment-methods/${c.id}/default`, 'POST')}>Make default</button>}
              <button className="link-btn danger" onClick={() => act(`/account/payment-methods/${c.id}`, 'DELETE')}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={s.run}>
        <Alert>{s.msg.err}</Alert><Alert kind="ok">{s.msg.ok}</Alert>
        <div className="grid-4">
          <Field label="Card number"><input inputMode="numeric" autoComplete="cc-number" required value={f.card_number} onChange={set('card_number')} placeholder="4242 4242 4242 4242" /></Field>
          <Field label="Exp. month"><input inputMode="numeric" required value={f.exp_month} onChange={set('exp_month')} placeholder="MM" /></Field>
          <Field label="Exp. year"><input inputMode="numeric" required value={f.exp_year} onChange={set('exp_year')} placeholder="YYYY" /></Field>
          <Field label="CVC"><input inputMode="numeric" autoComplete="cc-csc" value={f.cvc} onChange={set('cvc')} /></Field>
        </div>
        <button className="btn btn-ghost" disabled={s.busy}>Add card</button>
        <p className="muted small">Demo mode: we store only the card brand and last 4 digits. Connect a payment processor before taking real payments.</p>
      </form>
    </div>
  );
}

function Vehicle() {
  const { user, setUser } = useAuth();
  const { vehicles } = useVehicles();
  const d = user.driver || {};
  const [f, setF] = useState({ vehicle_type: d.vehicle_type, vehicle_make: d.vehicle_make || '', vehicle_model: d.vehicle_model || '', license_plate: d.license_plate || '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const s = useSubmit(async () => { setUser((await api('/account/vehicle', { method: 'PATCH', body: f })).user); return 'Vehicle updated'; });
  return (
    <form className="card" onSubmit={s.run}>
      <h2>Vehicle</h2>
      <Alert>{s.msg.err}</Alert><Alert kind="ok">{s.msg.ok}</Alert>
      <VehiclePicker vehicles={vehicles} value={f.vehicle_type} onChange={(v) => setF({ ...f, vehicle_type: v })} />
      <div className="grid-3">
        <Field label="Make"><input value={f.vehicle_make} onChange={set('vehicle_make')} /></Field>
        <Field label="Model"><input value={f.vehicle_model} onChange={set('vehicle_model')} /></Field>
        <Field label="Plate"><input value={f.license_plate} onChange={set('license_plate')} /></Field>
      </div>
      <button className="btn btn-primary" disabled={s.busy}>Save vehicle</button>
    </form>
  );
}

function Danger() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const s = useSubmit(async () => {
    if (!window.confirm('Close your account? This cannot be undone.')) return '';
    await api('/account', { method: 'DELETE' });
    setUser(null);
    navigate('/');
  });
  return (
    <div className="card">
      <h2>Close account</h2>
      <p className="muted">Removes your personal details, saved addresses and cards. Past delivery records are kept for the other party.</p>
      <Alert>{s.msg.err}</Alert>
      <button className="btn btn-danger" onClick={s.run} disabled={s.busy}>Close my account</button>
    </div>
  );
}

export default function Account() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs = [
    ['profile', 'Profile'],
    ['security', 'Password'],
    ...(user.role === 'customer' ? [['addresses', 'Addresses'], ['billing', 'Billing']] : []),
    ...(user.role === 'driver' ? [['vehicle', 'Vehicle']] : []),
    ...(user.role !== 'admin' ? [['close', 'Close account']] : []),
  ];
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'profile';
  return (
    <div className="container page">
      <h1>Account</h1>
      <div className="tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setParams({ tab: k })}>{label}</button>
        ))}
      </div>
      <div className="stack">
        {tab === 'profile' && <Profile />}
        {tab === 'security' && <Password />}
        {tab === 'addresses' && <Addresses />}
        {tab === 'billing' && <Billing />}
        {tab === 'vehicle' && <Vehicle />}
        {tab === 'close' && <Danger />}
      </div>
    </div>
  );
}
