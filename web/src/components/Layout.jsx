import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth.jsx';
import Logo from './Logo.jsx';

function NavLinks({ user, onLogout }) {
  if (!user) {
    return (
      <>
        <a href="/#vehicles">Vehicles</a>
        <a href="/#how">How it works</a>
        <NavLink to="/track">Track</NavLink>
        <NavLink to="/drivers">Drive with us</NavLink>
        <NavLink to="/login">Log in</NavLink>
        <Link to="/signup" className="btn btn-accent btn-sm">Get started</Link>
      </>
    );
  }
  return (
    <>
      {user.role === 'customer' && (
        <>
          <NavLink to="/app" end>Deliveries</NavLink>
          <NavLink to="/app/new">New delivery</NavLink>
        </>
      )}
      {user.role === 'driver' && <NavLink to="/driver">Jobs</NavLink>}
      {user.role === 'admin' && <NavLink to="/admin">CRM</NavLink>}
      <NavLink to="/track">Track</NavLink>
      <NavLink to="/account">Account</NavLink>
      <button className="link-btn" onClick={onLogout}>Log out</button>
    </>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Logo to={homeFor(user)} />
          <button className="menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
          <nav className={`nav ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
            <NavLinks user={user} onLogout={onLogout} />
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <Logo />
            <p className="muted">Same-day delivery for the businesses that build things.</p>
          </div>
          <div className="footer-cols">
            <div>
              <h4>Ship</h4>
              <Link to="/signup">Business signup</Link>
              <Link to="/track">Track a delivery</Link>
              <a href="/#vehicles">Vehicles &amp; pricing</a>
            </div>
            <div>
              <h4>Drive</h4>
              <Link to="/drivers">Become a driver</Link>
              <Link to="/login">Driver login</Link>
            </div>
          </div>
        </div>
        <div className="container fineprint">© {new Date().getFullYear()} DeliveredAI. All rights reserved.</div>
      </footer>
    </div>
  );
}
