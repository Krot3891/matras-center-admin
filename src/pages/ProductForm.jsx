import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Каркас форми додавання товару. Поля відповідають контракту API
// (docs/API_CONTRACT.md) та моделі Product у Prisma-схемі.
// Реальне збереження (POST /products) і завантаження фото в R2
// підключаються на Етапі 1, коли бекенд перестане повертати 501
// на ці маршрути.
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
  const [images, setImages] = useState([]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    // TODO (Етап 1):
    // 1. завантажити файли з `images` у Cloudflare R2 (через окремий
    //    підписаний upload-маршрут на бекенді);
    // 2. викликати apiFetch('/products', { method: 'POST', body: JSON.stringify({ ...form, images }) });
    // 3. після успіху navigate('/products');
    alert('Збереження товару буде підключено на Етапі 1');
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
            style={{ display: 'block', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Опис</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            style={{ display: 'block', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Ціна, ₴</label>
          <input
            name="price"
            type="number"
            value={form.price}
            onChange={handleChange}
            style={{ display: 'block', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>ID категорії</label>
          <input
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            style={{ display: 'block', width: '100%' }}
          />
          <small>Тимчасово вручну, поки немає вибору зі списку категорій.</small>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>SKU (унікальний артикул)</label>
          <input
            name="sku"
            value={form.sku}
            onChange={handleChange}
            style={{ display: 'block', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Кількість на складі</label>
          <input
            name="stockQty"
            type="number"
            value={form.stockQty}
            onChange={handleChange}
            style={{ display: 'block', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Фото товару</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => setImages(Array.from(e.target.files))}
            style={{ display: 'block', width: '100%' }}
          />
          <small>Завантаження у сховище (Cloudflare R2) підключимо на Етапі 1.</small>
        </div>

        <button type="submit">Зберегти товар</button>
      </form>
    </div>
  );
}
