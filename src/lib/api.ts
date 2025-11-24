import axios from 'axios';

// In dev we proxy `/api` to the backend via Vite dev server. Use empty base so callers provide the full path.
// If page is HTTPS but API base is HTTP, use empty base to use the Vite proxy instead
let baseURL = import.meta.env.VITE_API_BASE ?? '';

// Fix mixed content: if page is HTTPS and baseURL is HTTP, use relative URLs (Vite proxy)
if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
  if (baseURL && baseURL.startsWith('http://')) {
    console.warn('Mixed content detected: HTTPS page with HTTP API base. Using Vite proxy instead.');
    baseURL = ''; // Use relative URLs which will go through Vite proxy
  }
}

export const API_BASE = baseURL;

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Do not send cookies by default; we authenticate via Authorization header (bearer token)
  withCredentials: false,
});

export default api;
