import axios from 'axios';

// In dev we proxy `/api` to the backend via Vite dev server. Use empty base so callers provide the full path.
const baseURL = import.meta.env.VITE_API_BASE ?? '';

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
