import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';

// Каркас списку товарів. На Етапі 0 просто тягне публічний GET /products
// (він уже реально працює, бо не вимагає авторизації) — зручно перевірити
// з'єднання адмінки з API ще до того, як з'явиться форма додавання.
export default function ProductsList() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/products').then(setProducts).catch(setError);
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Товари</h1>
        <Link to="/products/new">+ Додати товар</Link>
      </div>

      {error && <p style={{ color: 'crimson' }}>Помилка з'єднання з API: {error.message}</p>}

      {products.length === 0 && !error && <p>Поки що товарів немає.</p>}

      <ul>
        {products.map((p) => (
          <li key={p.id}>
            {p.name} — {p.price} ₴ <Link to={`/products/${p.id}/edit`}>Редагувати</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
