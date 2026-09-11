import axios from 'axios';
import { API_BASE_URL } from './api';

// Every axios call anywhere in the app can now use relative paths like
// axios.get('/api/expenses') and it will automatically be sent to the
// correct backend (localhost in dev, the real domain in production),
// instead of every page hardcoding 'http://localhost:5000'.
axios.defaults.baseURL = API_BASE_URL;

// Every axios call anywhere in the app will now automatically include
// the logged-in user's token in the Authorization header.
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the backend says the token is missing/expired (401), log the user
// out on the frontend too and send them back to the login page.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);