import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api.js';

// Форма додавання товару. Поля відповідають контракту POST /products (matras-center-api):
// name, description, price, categoryId, sku, stockQty. slug сервер створює сам.
// Фото поки не завантажуються (Cloudflare R2 ще не підключено) — поле позначено як недоступне.

const FIELD_LABELS = {
  name: 'Назва',
  description: 'Опис',
  price: 'Ціна',
  categoryId: 'Категорія',
  sku: 'SKU',
  stockQty: 'Кількість на складі',
};

function saveErrorMessages(err) {
  if (err instanceof ApiError) {
    if (err.status === 400 && err.code === 'validation_error' && err.details?.length) {
      return err.details.map((d) => `${FIELD_LABELS[d.field] || d.field}: ${d.message}`);
    }
    if (err.code === 'category_not_found') {
      return ['Обрану категорію не знайдено. Оновіть сторінку й оберіть категорію ще раз.'];
    }
    if (err.code === 'sku_taken') return ['Товар із таким SKU вже існує. Вкажіть інший SKU.'];
    if (err.status === 401) return ['Сесія завершилась. Увійдіть знову.'];
    if (err.status === 501) return ['Сервер ще не підтримує створення товарів.'];
    return ['Сервер тимчасово недоступний. Спробуйте ще раз пізніше.'];
  }
  return ["Не вдалося з'єднатися з сервером. Перевірте інтернет і спробуйте ще раз."];
}

export default function ProductForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    sku: '',
    stockQty: '',
  });
  const [categories, setCategories] = useState([]);
  const [categoriesState, setCategoriesState] = useState('loading'); // loading | ready | error
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/categories')
      .then((list) => {
        setCategories(list || []);
        setCategoriesState('ready');
      })
      .catch(() => setCategoriesState('error'));
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors([]);
    setSaving(true);
    try {
      await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          price: Number(form.price),
          categoryId: form.categoryId,
          sku: form.sku.trim(),
          ...(form.stockQty !== '' ? { stockQty: Number(form.stockQty) } : {}),
        }),
      });
      navigate('/products');
    } catch (err) {
      setErrors(saveErrorMessages(err));
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Новий товар</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Назва</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            maxLength={200}
            style={{ display: 'block', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Опис</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            style={{ display: 'block', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Ціна, ₴</label>
          <input
            name="price"
            type="number"
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={handleChange}
            required
            style={{ display: 'block', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Категорія</label>
          <select
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            required
            disabled={categoriesState !== 'ready' || categories.length === 0}
            style={{ display: 'block', width: '100%' }}
          >
            <option value="">
              {categoriesState === 'loading' ? 'Завантаження…' : '— оберіть категорію —'}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {categoriesState === 'error' && (
            <small style={{ color: 'crimson' }}>
              Не вдалося завантажити категорії. Оновіть сторінку.
            </small>
          )}
          {categoriesState === 'ready' && categories.length === 0 && (
            <small>Категорій ще немає — товар без категорії зберегти не можна. Спершу створіть категорію.</small>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>SKU (унікальний артикул)</label>
          <input
            name="sku"
            value={form.sku}
            onChange={handleChange}
            required
            maxLength={64}
            style={{ display: 'block', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Кількість на складі</label>
          <input
            name="stockQty"
            type="number"
            min="0"
            step="1"
            value={form.stockQty}
            onChange={handleChange}
            style={{ display: 'block', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Фото товару (недоступно)</label>
          <input
            type="file"
            multiple
            accept="image/*"
            disabled
            style={{ display: 'block', width: '100%' }}
          />
          <small>
            Недоступно: завантаження фото в Cloudflare R2 ще не підключено. Товар буде збережено без фото.
          </small>
        </div>

        {errors.length > 0 && (
          <div role="alert" style={{ color: 'crimson', marginBottom: 12 }}>
            {errors.map((msg) => (
              <p key={msg} style={{ margin: '4px 0' }}>
                {msg}
              </p>
            ))}
          </div>
        )}

        <button type="submit" disabled={saving}>
          {saving ? 'Зберігаємо…' : 'Зберегти товар'}
        </button>
      </form>
    </div>
  );
}
