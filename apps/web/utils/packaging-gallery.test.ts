import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  packagingImageSrc,
  packagingImageSrcSet,
  visiblePackagingPhotos,
} from './packaging-gallery';

const cloudinary = 'https://res.cloudinary.com/demo/image/upload/v1/luxtime/homepage/packaging-a.jpg';

test('sin fotos válidas la sección no se muestra', () => {
  assert.deepEqual(visiblePackagingPhotos(null), []);
  assert.deepEqual(visiblePackagingPhotos([{ imageUrl: '  ' }, { imageUrl: '' }]), []);
  assert.equal(visiblePackagingPhotos([{ imageUrl: cloudinary }]).length, 1);
});

test('la miniatura sigue siendo la imagen, con tamaño acotado', () => {
  const src = packagingImageSrc(cloudinary, 640);
  assert.match(src, /^https:\/\/res\.cloudinary\.com\//);
  assert.match(src, /w_640/);
  assert.match(src, /f_auto/);
  assert.equal(packagingImageSrc('/uploads/homepage/caja.jpg', 640), '/uploads/homepage/caja.jpg');
  const srcset = packagingImageSrcSet(cloudinary, [480, 960]);
  assert.ok(srcset?.includes('480w'));
  assert.ok(srcset?.includes('960w'));
  assert.equal(packagingImageSrcSet('/uploads/caja.jpg', [480]), undefined);
});

test('el lightbox y la grilla no abren otra pestaña ni un enlace', () => {
  for (const file of ['PackagingLightbox.vue', 'PackagingSection.vue']) {
    const source = readFileSync(new URL(`../components/home/${file}`, import.meta.url), 'utf8');
    assert.equal(source.includes('<a '), false, file);
    assert.equal(source.includes('target="_blank"'), false, file);
    assert.equal(source.includes('window.open'), false, file);
    assert.equal(source.includes('res.cloudinary.com'), false, file);
  }
});
