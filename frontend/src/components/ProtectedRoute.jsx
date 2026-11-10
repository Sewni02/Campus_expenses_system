import { Navigate, useLocation } from 'react-router-dom';
import { getSavedUser } from '../utils/session';

// Wrap any <Route> element with this to require login (and optionally a
// specific role) before it renders. Keeps unauthenticated / unauthorized
// users from ever seeing a protected page, instead of just silently
// failing to load its data.
//
// The page the user actually tried to open (path + query string, so the
// exact tab they were on) is remembered in `next`, and Login sends them
// back there after a successful sign-in.
//
// Usage:
//   <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
//   <Route path="/admin/users" element={
//     <ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>
//   } />
function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  // The login itself is an httpOnly cookie the page can't see. If it has
  // expired, the first API call returns 401 and axiosConfig sends the user to /login.
  const user = getSavedUser();

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Non-admins who aren't approved yet always get sent to the waiting page,
  // no matter which protected route they tried to open directly.
  if (user.role !== 'super_admin' && user.status !== 'approved') {
    return <Navigate to="/waiting-approval" replace />;
  }

  return children;
}

export default ProtectedRoute;