import { useState } from 'react';

// Каркас екрана логіну. Реальний виклик /auth/login додається на Етапі 1,
// коли бекенд перестане повертати 501 на цей маршрут.
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    // TODO (Етап 1): apiFetch('/auth/login', { method: 'POST', body: ... })
    alert('Логін буде підключено на Етапі 1');
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
            style={{ display: 'block', width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </div>
        <button type="submit">Увійти</button>
      </form>
    </div>
  );
}
