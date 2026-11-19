import axios from 'axios';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';
// Server address without "/api/v1", used for public files such as company logos
export const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

const TOKEN_KEY = 'jobnest_token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable: token is kept in memory only for this session */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

const client = axios.create({ baseURL: API_URL, timeout: 30000 });

// Attach the JWT to every request
client.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is invalid or expired, tell the AuthContext to log out
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const status = error.response?.status;
    const data = error.response?.data;
    // Expired/invalid token, or the administrator deactivated this account: log out with the reason
    // (login, sign-up and password-reset pages show this message themselves)
    const authForm = /\/auth\/(login|signup|forgot-password|reset-password)/.test(url);
    const deactivated = status === 403 && data?.details?.code === 'ACCOUNT_DEACTIVATED' && !authForm;
    if ((status === 401 && !url.includes('/auth/login')) || deactivated) {
      window.dispatchEvent(new CustomEvent('jobnest:unauthorized', { detail: data?.error }));
    }
    return Promise.reject(error);
  }
);

export default client;
