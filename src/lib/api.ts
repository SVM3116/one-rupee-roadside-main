import axios from 'axios';

// In development, use empty base to go through Vite proxy
// In production, use the environment variable
const isDevelopment = import.meta.env.DEV;
let baseURL = '';

if (!isDevelopment) {
  // Only use VITE_API_BASE in production
  baseURL = import.meta.env.VITE_API_BASE ?? '';
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
