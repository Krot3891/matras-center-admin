import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api.js';

// Форма товару: додавання (/products/new, POST /products) і редагування (/products/:id/edit, PATCH /products/:id).
// Поля відповідають контракту matras-center-api: name, description, price, categoryId, sku, stockQty.
// slug сервер створює сам і не змінює. Окремого GET /products/:id в API немає, тому при редагуванні
// товар береться зі списку GET /products (публічного, лише опубліковані) за id.
// Фото поки не завантажуються (Cloudflare R2 ще не підключено) — поле позначено як недоступне.

const FIELD_LABELS = {
  name: 'Назва',
  description: 'Опис',
  price: 'Ціна',
  categoryId: 'Категорія',
  sku: 'SKU',
  stockQty: 'Кількість на складі',
};

const EMPTY_FORM = { name: '', description: '', price: '', categoryId: '', sku: '', stockQty: '' };

function toFormValues(p) {
  return {
    name: p.name ?? '',
    description: p.description ?? '',
    price: p.price != null ? String(Number(p.price)) : '',
    categoryId: p.categoryId ?? '',
    sku: p.sku ?? '',
    stockQty: p.stockQty != null ? String(p.stockQty) : '',
  };
}

function saveErrorMessages(err, isEdit) {
  if (err instanceof ApiError) {
    if (err.status === 400 && err.code === 'validation_error' && err.details?.length) {
      return err.details.map((d) => `${FIELD_LABELS[d.field] || d.field}: ${d.message}`);
    }
    if (err.code === 'category_not_found') {
      return ['Обрану категорію не знайдено. Оновіть сторінку й оберіть категорію ще раз.'];
    }
    if (err.code === 'not_found') return ['Товар не знайдено — можливо, його вже видалено.'];
    if (err.code === 'sku_taken') return ['Товар із таким SKU вже існує. Вкажіть інший SKU.'];
    if (err.status === 401) return ['Сесія завершилась. Увійдіть знову.'];
    if (err.status === 501) return [`Сервер ще не підтримує ${isEdit ? 'редагування' : 'створення'} товарів.`];
    return ['Сервер тимчасово недоступний. Спробуйте ще раз пізніше.'];
  }
  return ["Не вдалося з'єднатися з сервером. Перевірте інтернет і спробуйте ще раз."];
}

export default function ProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [initial, setInitial] = useState(null); // значення з сервера (для надсилання лише змінених полів)
  const [productState, setProductState] = useState(isEdit ? 'loading' : 'ready'); // loading | ready | notfound | error
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

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    setProductState('loading');
    apiFetch('/products')
      .then((list) => {
        if (cancelled) return;
        const product = (list || []).find((p) => p.id === id);
        if (!product) return setProductState('notfound');
        const values = toFormValues(product);
        setInitial(values);
        setForm(values);
        setProductState('ready');
      })
      .catch(() => !cancelled && setProductState('error'));
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors([]);
    const values = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      categoryId: form.categoryId,
      sku: form.sku.trim(),
      ...(form.stockQty !== '' ? { stockQty: Number(form.stockQty) } : {}),
    };

    let request;
    if (isEdit) {
      // PATCH: надсилаємо лише змінені поля
      const before = initial;
      const changed = {};
      for (const [key, value] of Object.entries(values)) {
        const was = ['price', 'stockQty'].includes(key) ? Number(before[key]) : before[key].trim();
        if (value !== was) changed[key] = value;
      }
      if (Object.keys(changed).length === 0) {
        setErrors(['Змін не внесено.']);
        return;
      }
      request = { path: `/products/${encodeURIComponent(id)}`, method: 'PATCH', body: changed };
    } else {
      request = { path: '/products', method: 'POST', body: values };
    }

    setSaving(true);
    try {
      await apiFetch(request.path, { method: request.method, body: JSON.stringify(request.body) });
      navigate('/products');
    } catch (err) {
      // введені дані лишаються у формі
      setErrors(saveErrorMessages(err, isEdit));
      setSaving(false);
    }
  }

  if (isEdit && productState !== 'ready') {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'sans-serif' }}>
        <h1>Редагування товару</h1>
        {productState === 'loading' && <p>Завантаження…</p>}
        {productState === 'notfound' && (
          <p style={{ color: 'crimson' }}>Товар не знайдено (можливо, його видалено або він не опублікований).</p>
        )}
        {productState === 'error' && (
          <p style={{ color: 'crimson' }}>Не вдалося завантажити товар. Оновіть сторінку.</p>
        )}
        <Link to="/products">← До списку товарів</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>{isEdit ? 'Редагування товару' : 'Новий товар'}</h1>
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
            Недоступно: завантаження фото в Cloudflare R2 ще не підключено.{' '}
            {isEdit ? 'Фото товару не змінюються.' : 'Товар буде збережено без фото.'}
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
          {saving ? 'Зберігаємо…' : isEdit ? 'Зберегти зміни' : 'Зберегти товар'}
        </button>
      </form>
    </div>
  );
}
