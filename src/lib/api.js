// Адреса API: з VITE_API_URL, а якщо не задано — продакшн-API на Render (адреса публічна, не секрет).
const API_URL = (import.meta.env.VITE_API_URL || 'https://matras-center-api.onrender.com').replace(/\/+$/, '');

const TOKEN_KEY = 'adminToken';

// --- JWT у localStorage (обгортки з try/catch: сховище може бути недоступне, напр. у приватному режимі) ---
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* нічого робити */
  }
}

// Лише для UX: чи токен виглядає чинним (є і не прострочений). Підпис тут НЕ перевіряється —
// справжню перевірку робить сервер (requireAdmin) на кожному захищеному запиті.
export function isTokenValid(token = getToken()) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(status, code, details) {
    super(`API error ${status}${code ? `: ${code}` : ''}`);
    this.status = status; // HTTP-статус відповіді
    this.code = code; // поле "error" з тіла відповіді, напр. "invalid_credentials"
    this.details = details; // для validation_error: [{ field, message }]
  }
}

// Легка обгортка над fetch — єдине місце, де прописана адреса API і заголовок авторизації.
// { auth: false } — не додавати токен (для самого логіну).
export async function apiFetch(path, options = {}) {
  const { auth = true, ...fetchOptions } = options;
  const token = auth ? getToken() : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* порожнє або не-JSON тіло */
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      // токен відхилено сервером (прострочений/недійсний) — виходимо на екран входу
      clearToken();
      window.location.assign('/login');
    }
    throw new ApiError(res.status, data?.error, data?.details);
  }

  return data;
}
