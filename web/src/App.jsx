import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import DriverSignup from './pages/DriverSignup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NewOrder from './pages/NewOrder.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Track from './pages/Track.jsx';
import Account from './pages/Account.jsx';
import DriverHome from './pages/DriverHome.jsx';
import DriverJob from './pages/DriverJob.jsx';
import Admin from './pages/Admin.jsx';
import NotFound from './pages/NotFound.jsx';

function Protected({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <div className="page-loading">Loading…</div>;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/track" element={<Track />} />
        <Route path="/track/:code" element={<Track />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
        <Route path="/drivers" element={<GuestOnly><DriverSignup /></GuestOnly>} />
        <Route path="/app" element={<Protected roles={['customer']}><Dashboard /></Protected>} />
        <Route path="/app/new" element={<Protected roles={['customer']}><NewOrder /></Protected>} />
        <Route path="/app/orders/:id" element={<Protected roles={['customer', 'admin']}><OrderDetail /></Protected>} />
        <Route path="/account" element={<Protected><Account /></Protected>} />
        <Route path="/driver" element={<Protected roles={['driver']}><DriverHome /></Protected>} />
        <Route path="/driver/jobs/:id" element={<Protected roles={['driver']}><DriverJob /></Protected>} />
        <Route path="/admin" element={<Protected roles={['admin']}><Admin /></Protected>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
