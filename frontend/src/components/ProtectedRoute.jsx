import { Navigate } from 'react-router-dom';

// Wrap any <Route> element with this to require login (and optionally a
// specific role) before it renders. Keeps unauthenticated / unauthorized
// users from ever seeing a protected page, instead of just silently
// failing to load its data.
//
// Usage:
//   <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
//   <Route path="/admin/users" element={
//     <ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>
//   } />
function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('token');
  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : null;

  if (!token || !user) {
    return <Navigate to="/login" replace />;
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