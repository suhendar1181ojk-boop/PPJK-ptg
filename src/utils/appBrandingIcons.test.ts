import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDynamicManifestPayload,
  computeBrandingLogoHash,
  derivePwaShortName,
  parsePngDataUrlToBase64,
} from './appBrandingIcons.ts';

test('derivePwaShortName enforces <= 12 character rule and falls back cleanly', () => {
  assert.equal(derivePwaShortName(''), 'PTG PPJK');
  assert.equal(derivePwaShortName('  PTG   PPJK  '), 'PTG PPJK');
  assert.equal(derivePwaShortName('Samudera Raya'), 'Samudera Ray');
  assert.ok(derivePwaShortName('Perusahaan Kepabeanan Panjang').length <= 12);
});

test('computeBrandingLogoHash produces deterministic 8-char hex digests', () => {
  const h1 = computeBrandingLogoHash('data:image/png;base64,AAA', 'PTG PPJK');
  const h2 = computeBrandingLogoHash('data:image/png;base64,AAA', 'PTG PPJK');
  const h3 = computeBrandingLogoHash('data:image/png;base64,BBB', 'PTG PPJK');
  assert.match(h1, /^[0-9a-f]{8}$/);
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test('parsePngDataUrlToBase64 validates PNG data URLs strictly', () => {
  assert.equal(parsePngDataUrlToBase64('data:image/png;base64,iVBORw0KGgo='), 'iVBORw0KGgo=');
  assert.equal(parsePngDataUrlToBase64('data:image/jpeg;base64,/9j/4AAQ'), null);
  assert.equal(parsePngDataUrlToBase64('javascript:alert(1)'), null);
  assert.equal(parsePngDataUrlToBase64(''), null);
});

test('buildDynamicManifestPayload produces compliant PWA manifest with separate any and maskable icons', () => {
  const manifest = buildDynamicManifestPayload({
    name: 'PT Bintang Samudera PPJK',
    description: 'Sistem tracking dokumen impor',
    iconUrls: {
      pwa192: '/pwa-192x192.png?v=1234abcd',
      pwa512: '/pwa-512x512.png?v=1234abcd',
      maskable512: '/pwa-maskable-512x512.png?v=1234abcd',
    },
  });

  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.name, 'PT Bintang Samudera PPJK');
  assert.ok(manifest.short_name.length <= 12);
  assert.equal(manifest.icons.length, 3);
  assert.deepEqual(
    manifest.icons.map((i) => ({ sizes: i.sizes, purpose: i.purpose })),
    [
      { sizes: '192x192', purpose: 'any' },
      { sizes: '512x512', purpose: 'any' },
      { sizes: '512x512', purpose: 'maskable' },
    ]
  );
});
