import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api.js';
import { MAX_PHOTOS, selectPhotos, uploadErrorText } from '../lib/photoRules.js';

// Форма товару: додавання (/products/new, POST /products) і редагування (/products/:id/edit, PATCH /products/:id).
// Поля відповідають контракту matras-center-api: name, description, price, categoryId, sku, stockQty.
// slug сервер створює сам і не змінює. Окремого GET /products/:id в API немає, тому при редагуванні
// товар береться зі списку GET /products (публічного, лише опубліковані) за id.
//
// Фото (JPEG/PNG/WebP, до 5 МБ, до 10 на товар) вибираються у формі й завантажуються при збереженні:
//  - створення: кожен файл → POST /uploads/images (поле file) → url; потім POST /products з images: [{ url }];
//  - редагування: спершу PATCH полів, потім кожен новий файл → POST /products/:id/images (завантаження + прив'язка).
// Видалення збережених фото API ще не підтримує, тому вони лише показуються.

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
  const [savingLabel, setSavingLabel] = useState('Зберігаємо…');
  // Фото: збережені (лише при редагуванні) і вибрані, але ще не збережені ({ key, file, preview, url?, error? })
  const [existingImages, setExistingImages] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [photoNotes, setPhotoNotes] = useState([]);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const photoKey = useRef(0);

  // прев'ю — це blob-посилання; звільняємо їх при виході зі сторінки
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

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
        setExistingImages(product.images || []);
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

  function handleFilesChange(e) {
    const { accepted, errors: rejected } = selectPhotos(
      Array.from(e.target.files || []),
      existingImages.length + photos.length
    );
    e.target.value = ''; // щоб той самий файл можна було вибрати знову
    setPhotoNotes(rejected);
    setPhotos((prev) => [
      ...prev,
      ...accepted.map((file) => {
        photoKey.current += 1;
        return { key: photoKey.current, file, preview: URL.createObjectURL(file) };
      }),
    ]);
  }

  function removePhoto(key) {
    const photo = photos.find((p) => p.key === key);
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhotos((prev) => prev.filter((p) => p.key !== key));
    setPhotoNotes([]);
  }

  const patchPhoto = (key, patch) => setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const uploadFile = (path, file) => {
    const body = new FormData();
    body.append('file', file); // API очікує файл у полі "file"
    return apiFetch(path, { method: 'POST', body });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors([]);
    setPhotoNotes([]);
    const values = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      categoryId: form.categoryId,
      sku: form.sku.trim(),
      ...(form.stockQty !== '' ? { stockQty: Number(form.stockQty) } : {}),
    };

    if (isEdit) {
      // PATCH: надсилаємо лише змінені поля
      const changed = {};
      for (const [key, value] of Object.entries(values)) {
        const was = ['price', 'stockQty'].includes(key) ? Number(initial[key]) : initial[key].trim();
        if (value !== was) changed[key] = value;
      }
      if (Object.keys(changed).length === 0 && photos.length === 0) {
        setErrors(['Змін не внесено.']);
        return;
      }

      setSaving(true);
      setSavingLabel('Зберігаємо…');
      try {
        if (Object.keys(changed).length > 0) {
          await apiFetch(`/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changed) });
          // поля збережено: надалі порівнюємо з новими значеннями (повторне збереження не надішле їх знову)
          const saved = {
            name: values.name,
            description: values.description,
            price: String(values.price),
            categoryId: values.categoryId,
            sku: values.sku,
            stockQty: 'stockQty' in values ? String(values.stockQty) : initial.stockQty,
          };
          setInitial(saved);
          setForm(saved);
        }
      } catch (err) {
        // введені дані (і вибрані фото) лишаються у формі
        setErrors(saveErrorMessages(err, true));
        setSaving(false);
        return;
      }

      // Нові фото: POST /products/:id/images (завантаження в R2 + запис ProductImage)
      const failed = [];
      const list = [...photos];
      for (let i = 0; i < list.length; i += 1) {
        const photo = list[i];
        setSavingLabel(`Завантажуємо фото ${i + 1} з ${list.length}…`);
        try {
          const row = await uploadFile(`/products/${encodeURIComponent(id)}/images`, photo.file);
          setExistingImages((prev) => [...prev, row]);
          URL.revokeObjectURL(photo.preview);
          setPhotos((prev) => prev.filter((p) => p.key !== photo.key));
        } catch (err) {
          const message = uploadErrorText(err instanceof ApiError ? err : {});
          patchPhoto(photo.key, { error: message });
          failed.push(`${photo.file.name}: ${message}`);
          if (err instanceof ApiError && ['too_many_images', 'not_found', 'storage_not_configured'].includes(err.code)) break;
        }
      }
      if (failed.length > 0) {
        setErrors(['Дані товару збережено, але не всі фото завантажено:', ...failed]);
        setSaving(false);
        return;
      }
      navigate('/products');
      return;
    }

    // Створення: спершу фото → POST /uploads/images (отримуємо url), потім сам товар з images
    setSaving(true);
    const failed = [];
    const list = photos.map((p) => ({ ...p }));
    for (let i = 0; i < list.length; i += 1) {
      const photo = list[i];
      if (photo.url) continue; // вже завантажено під час попередньої спроби — повторно не вантажимо
      setSavingLabel(`Завантажуємо фото ${i + 1} з ${list.length}…`);
      try {
        const uploaded = await uploadFile('/uploads/images', photo.file);
        photo.url = uploaded.url;
        patchPhoto(photo.key, { url: uploaded.url, error: undefined });
      } catch (err) {
        const message = uploadErrorText(err instanceof ApiError ? err : {});
        patchPhoto(photo.key, { error: message });
        failed.push(`${photo.file.name}: ${message}`);
        if (err instanceof ApiError && ['storage_not_configured'].includes(err.code)) break;
      }
    }
    if (failed.length > 0) {
      setErrors(['Товар ще не створено — не всі фото завантажено:', ...failed]);
      setSaving(false);
      return;
    }

    setSavingLabel('Зберігаємо…');
    try {
      await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({ ...values, ...(list.length ? { images: list.map((p) => ({ url: p.url })) } : {}) }),
      });
      navigate('/products');
    } catch (err) {
      // введені дані та вибрані фото лишаються у формі (завантажені файли повторно не вантажаться)
      setErrors(saveErrorMessages(err, false));
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
          <label>Фото товару</label>
          <input
            type="file"
            name="photos"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFilesChange}
            disabled={saving || existingImages.length + photos.length >= MAX_PHOTOS}
            style={{ display: 'block', width: '100%' }}
          />
          <small>
            JPEG, PNG або WebP, до 5 МБ кожне, не більше {MAX_PHOTOS} фото на товар. Фото завантажаться після
            натискання «{isEdit ? 'Зберегти зміни' : 'Зберегти товар'}».
            {isEdit && ' Видалити збережені фото поки що не можна.'}
          </small>
          {photoNotes.length > 0 && (
            <div role="alert" style={{ color: 'crimson', margin: '4px 0' }}>
              {photoNotes.map((msg) => (
                <div key={msg}>
                  <small>{msg}</small>
                </div>
              ))}
            </div>
          )}
          {(existingImages.length > 0 || photos.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {existingImages.map((img) => (
                <figure key={img.id} style={{ margin: 0, width: 96 }}>
                  <img
                    src={img.url}
                    alt={img.alt || 'Фото товару'}
                    style={{ width: 96, height: 96, objectFit: 'cover', display: 'block' }}
                  />
                  <figcaption>
                    <small>збережено</small>
                  </figcaption>
                </figure>
              ))}
              {photos.map((p) => (
                <figure key={p.key} data-pending-photo style={{ margin: 0, width: 96 }}>
                  <img
                    src={p.preview}
                    alt={`Попередній перегляд: ${p.file.name}`}
                    style={{ width: 96, height: 96, objectFit: 'cover', display: 'block' }}
                  />
                  <figcaption>
                    <small style={{ color: p.error ? 'crimson' : undefined }}>
                      {p.error ? 'помилка' : p.url ? 'завантажено' : 'буде завантажено'}
                    </small>{' '}
                    <button type="button" onClick={() => removePhoto(p.key)} disabled={saving} aria-label={`Прибрати ${p.file.name}`}>
                      ✕
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
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
          {saving ? savingLabel : isEdit ? 'Зберегти зміни' : 'Зберегти товар'}
        </button>
      </form>
    </div>
  );
}
