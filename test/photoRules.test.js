import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  validatePhotoFile,
  selectPhotos,
  uploadErrorText,
} from '../src/lib/photoRules.js';

const file = (name, type, size = 1000) => ({ name, type, size });

test('validatePhotoFile: JPEG, PNG, WebP (і image/jpg) приймаються', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'IMAGE/PNG']) {
    assert.equal(validatePhotoFile(file('a', type)), null, type);
  }
});

test('validatePhotoFile: SVG, GIF, PDF, без типу — відхиляються', () => {
  for (const type of ['image/svg+xml', 'image/gif', 'application/pdf', 'text/html', '']) {
    assert.match(validatePhotoFile(file('a', type)), /JPEG, PNG або WebP/, type);
  }
});

test('validatePhotoFile: межа 5 МБ — рівно 5 МБ можна, на байт більше ні; порожній файл ні', () => {
  assert.equal(validatePhotoFile(file('a', 'image/png', MAX_PHOTO_BYTES)), null);
  assert.match(validatePhotoFile(file('a', 'image/png', MAX_PHOTO_BYTES + 1)), /5 МБ/);
  assert.match(validatePhotoFile(file('a', 'image/png', 0)), /порожній/);
});

test('selectPhotos: придатні проходять, непридатні дають помилку з назвою файлу', () => {
  const { accepted, errors } = selectPhotos([file('ok.jpg', 'image/jpeg'), file('bad.gif', 'image/gif'), file('big.png', 'image/png', MAX_PHOTO_BYTES + 1)]);
  assert.deepEqual(accepted.map((f) => f.name), ['ok.jpg']);
  assert.equal(errors.length, 2);
  assert.ok(errors[0].startsWith('bad.gif:') && errors[1].startsWith('big.png:'));
});

test('selectPhotos: ліміт 10 фото враховує вже наявні', () => {
  const many = Array.from({ length: 5 }, (_, i) => file(`f${i}.jpg`, 'image/jpeg'));
  const { accepted, errors } = selectPhotos(many, MAX_PHOTOS - 3);
  assert.equal(accepted.length, 3);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /не більше 10 фото/);
  assert.equal(selectPhotos(many, MAX_PHOTOS).accepted.length, 0);
});

test('uploadErrorText: тексти для кодів API та мережі', () => {
  assert.match(uploadErrorText({ status: 413, code: 'file_too_large' }), /завеликий/);
  assert.match(uploadErrorText({ status: 415, code: 'unsupported_type' }), /JPEG, PNG або WebP/);
  assert.match(uploadErrorText({ status: 409, code: 'too_many_images' }), /максимум фото/);
  assert.match(uploadErrorText({ status: 404, code: 'not_found' }), /не знайдено/);
  assert.match(uploadErrorText({ status: 503, code: 'storage_not_configured' }), /R2/);
  assert.match(uploadErrorText({ status: 502, code: 'storage_error' }), /тимчасово/);
  assert.match(uploadErrorText({ status: 401 }), /сесія завершилась/);
  assert.match(uploadErrorText({ status: 500, code: 'server_error' }), /тимчасово недоступний/);
  assert.match(uploadErrorText({}), /з'єднатися/);
  assert.match(uploadErrorText(), /з'єднатися/);
});
