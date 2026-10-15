// Правила вибору фото в адмінці. Збігаються з обмеженнями API (matras-center-api):
// JPEG/PNG/WebP, до 5 МБ, не більше 10 фото на товар. Остаточну перевірку (за вмістом файлу) робить сервер.
// Модуль без залежностей від браузера й API, щоб його можна було тестувати окремо.

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 10;
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function normalizeType(type) {
  const t = String(type || '').toLowerCase();
  return t === 'image/jpg' ? 'image/jpeg' : t;
}

// Повертає текст помилки або null, якщо файл підходить
export function validatePhotoFile(file) {
  if (!ALLOWED_PHOTO_TYPES.includes(normalizeType(file.type))) {
    return 'Дозволені лише JPEG, PNG або WebP.';
  }
  if (file.size === 0) return 'Файл порожній.';
  if (file.size > MAX_PHOTO_BYTES) return 'Файл завеликий — максимум 5 МБ.';
  return null;
}

// Відбирає придатні файли з урахуванням ліміту. currentCount — скільки фото в товару вже є (збережених + доданих).
export function selectPhotos(files, currentCount = 0) {
  const accepted = [];
  const errors = [];
  for (const file of files) {
    const problem = validatePhotoFile(file);
    if (problem) {
      errors.push(`${file.name}: ${problem}`);
    } else if (currentCount + accepted.length >= MAX_PHOTOS) {
      errors.push(`${file.name}: перевищено ліміт — не більше ${MAX_PHOTOS} фото на товар.`);
    } else {
      accepted.push(file);
    }
  }
  return { accepted, errors };
}

// Текст помилки завантаження за відповіддю API ({ status, code }); status 0/undefined — немає зв'язку з сервером
export function uploadErrorText({ status, code } = {}) {
  if (code === 'file_too_large') return 'файл завеликий — максимум 5 МБ.';
  if (code === 'unsupported_type') return 'непідтримуваний формат — дозволені лише JPEG, PNG або WebP.';
  if (code === 'file_required' || code === 'unexpected_field' || code === 'invalid_multipart') {
    return 'сервер не прийняв файл. Виберіть його ще раз.';
  }
  if (code === 'too_many_images') return `у товару вже максимум фото (${MAX_PHOTOS}).`;
  if (code === 'not_found') return 'товар не знайдено — можливо, його вже видалено.';
  if (code === 'storage_not_configured') return 'сховище фото на сервері ще не налаштоване (Cloudflare R2).';
  if (code === 'storage_error') return 'сховище фото тимчасово недоступне. Спробуйте ще раз пізніше.';
  if (status === 401) return 'сесія завершилась. Увійдіть знову.';
  if (status) return 'сервер тимчасово недоступний. Спробуйте ще раз пізніше.';
  return "не вдалося з'єднатися з сервером.";
}
