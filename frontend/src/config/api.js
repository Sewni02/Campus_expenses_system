// Base URL for all backend API calls.
// - In local development, Vite falls back to http://localhost:5000 automatically.
// - In production (cPanel), set VITE_API_URL in frontend/.env.production to your
//   live backend URL (e.g. https://api.yourdomain.com or https://yourdomain.com)
//   before running `npm run build`.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';