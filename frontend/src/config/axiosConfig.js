import axios from 'axios';
import { API_BASE_URL } from './api';

// Every axios call anywhere in the app can now use relative paths like
// axios.get('/api/expenses') and it will automatically be sent to the
// correct backend (localhost in dev, the real domain in production),
// instead of every page hardcoding 'http://localhost:5000'.
axios.defaults.baseURL = API_BASE_URL;

// Without this, a slow/stuck backend or database connection means the
// browser just waits forever with no feedback - the "Saving..." button
// stays there indefinitely. 30s is generous enough for a bill/slip photo
// upload, but still gives the user a clear error instead of an endless wait.
axios.defaults.timeout = 30000;

// The login token is stored in an httpOnly cookie (set by the server on login).
// `withCredentials` makes the browser send that cookie with every request,
// including to the API's own domain/port. No token is read or attached here
// any more, so nothing in the page's JavaScript can leak it.
axios.defaults.withCredentials = true;

// If the backend says the login is missing/expired (401), forget the saved
// profile on the frontend too and send the user back to the login page -
// keeping a note of the page + tab they were on so login can return them there.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      const current = window.location.pathname + window.location.search;
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?next=${encodeURIComponent(current)}`;
      }
    }
    return Promise.reject(error);
  }
);