import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupImportMediaFiles,
  parseImportMediaFileName,
} from './import-photo-names';

test('acepta variantes de frente/dorso/video', () => {
  assert.deepEqual(parseImportMediaFileName('001_1_frente.jpg'), {
    importKey: '001',
    slot: 'front',
    fileName: '001_1_frente.jpg',
  });
  assert.equal(parseImportMediaFileName('001_2_dorso.jpg')?.slot, 'back');
  assert.equal(parseImportMediaFileName('001_video.mp4')?.slot, 'video');
  assert.equal(parseImportMediaFileName('001-frente.jpeg')?.slot, 'front');
  assert.equal(parseImportMediaFileName('001-dorso.png')?.slot, 'back');
  assert.equal(parseImportMediaFileName('001_1.webp')?.slot, 'front');
  assert.equal(parseImportMediaFileName('001_2.JPG')?.slot, 'back');
  assert.equal(parseImportMediaFileName('001_1_FRENTE.JPG')?.slot, 'front');
  assert.equal(parseImportMediaFileName('1_1_frente.jpg')?.importKey, '1');
});

test('rechaza nombres sin número', () => {
  assert.equal(parseImportMediaFileName('frente.jpg'), null);
  assert.equal(parseImportMediaFileName('foto.png'), null);
});

test('agrupa por Nº e ignora basura', () => {
  const files = [
    new File([new Uint8Array([1])], '002_1_frente.jpg', { type: 'image/jpeg' }),
    new File([new Uint8Array([1])], '002_2_dorso.jpg', { type: 'image/jpeg' }),
    new File([new Uint8Array([1])], 'basura.txt', { type: 'text/plain' }),
  ];
  const { groups, ignored } = groupImportMediaFiles(files);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].importKey, '002');
  assert.ok(groups[0].front);
  assert.ok(groups[0].back);
  assert.deepEqual(ignored, ['basura.txt']);
});
