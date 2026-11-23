// Base URL for all backend API calls.
// - Development (`npm run dev`): empty string, so requests go to the Vite dev server,
//   which proxies /api to http://localhost:5000 (see vite.config.js). This keeps the
//   login cookie on the same origin, and ignores any live VITE_API_URL left in a .env file.
// - Production (cPanel): set VITE_API_URL in frontend/.env.production to your live
//   backend URL (e.g. https://api.yourdomain.com) before running `npm run build`.
export const API_BASE_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_API_URL || 'http://localhost:5000';