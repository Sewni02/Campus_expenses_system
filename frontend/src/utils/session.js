import axios from 'axios';

// The login token now lives in an httpOnly cookie that the browser sends by
// itself, so JavaScript can't (and doesn't need to) touch it.
// All that is kept in localStorage is the user's profile (name, role,
// permissions), only used to decide which screens to show. The server still
// checks every request.

export function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

export function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
}

// Asks the server to clear the cookie, then forgets the profile on this device.
// Even if the server can't be reached, the local data is still cleared.
export async function logout() {
  try {
    await axios.post('/api/auth/logout');
  } catch {
    // ignore - we still clear everything locally below
  }
  localStorage.removeItem('token'); // left over from older versions of the app
  localStorage.removeItem('user');
}