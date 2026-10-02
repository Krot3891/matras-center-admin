const API_URL = import.meta.env.VITE_API_URL;

// Легка обгортка над fetch — єдине місце, де прописана адреса API
// і заголовок авторизації, коли той з'явиться на Етапі 1.
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('adminToken');

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }

  return res.json();
}
