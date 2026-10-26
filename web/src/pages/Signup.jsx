import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert, Field } from '../components/ui.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', company_name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signup({ ...f, role: 'customer' });
      navigate(sessionStorage.getItem('dai_draft') ? '/app/new' : '/app', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Create your business account</h1>
        <p className="muted">Free to sign up. You only pay for deliveries you book.</p>
        <Alert>{error}</Alert>
        <Field label="Your name"><input required autoComplete="name" value={f.name} onChange={set('name')} /></Field>
        <Field label="Company"><input autoComplete="organization" value={f.company_name} onChange={set('company_name')} /></Field>
        <Field label="Work email"><input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone"><input type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Password" hint="At least 8 characters">
          <input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="auth-alt">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
