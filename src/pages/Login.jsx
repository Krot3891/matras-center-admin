import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiFetch, setToken, isTokenValid, ApiError } from '../lib/api.js';

function errorMessage(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Невірний email або пароль.';
    if (err.status === 429) return 'Забагато невдалих спроб. Спробуйте за 15 хвилин.';
    if (err.status === 400) return 'Перевірте email і пароль.';
    return 'Сервер тимчасово недоступний. Спробуйте ще раз пізніше.';
  }
  return "Не вдалося з'єднатися з сервером. Перевірте інтернет і спробуйте ще раз.";
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Уже авторизований — одразу до списку товарів
  if (isTokenValid()) return <Navigate to="/products" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password }),
      });
      if (!data?.token) throw new Error('У відповіді немає токена');
      setToken(data.token);
      navigate('/products', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Вхід в адмін-панель</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            style={{ display: 'block', width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{ display: 'block', width: '100%' }}
          />
        </div>

        {error && (
          <p role="alert" style={{ color: 'crimson' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Входимо…' : 'Увійти'}
        </button>
        {loading && (
          <p style={{ fontSize: 13, color: '#666' }}>
            Якщо сервер «спав», перший вхід може зайняти до хвилини.
          </p>
        )}
      </form>
    </div>
  );
}
