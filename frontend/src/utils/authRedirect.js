// Where to send someone right after they signed in (password or Google / Facebook).
export function pathAfterLogin(user, next) {
  if (user.role !== 'super_admin' && user.status !== 'approved') return '/waiting-approval';
  if (next) return next;
  if (user.role === 'super_admin') return '/admin/users';
  return '/dashboard';
}