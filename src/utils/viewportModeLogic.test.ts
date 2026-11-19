import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIEWPORT_MODE_CONFIGS,
  VIEWPORT_MODE_ORDER,
  VIEWPORT_MODE_STORAGE_KEY,
  detectDefaultViewportMode,
  getNextViewportMode,
  getViewportModeConfig,
  isValidViewportMode,
  parseStoredViewportMode,
  serializeViewportMode,
} from './viewportModeLogic';

test('detectDefaultViewportMode maps screen widths to mobile, tablet, and desktop accurately', () => {
  assert.equal(detectDefaultViewportMode(375), 'mobile');
  assert.equal(detectDefaultViewportMode(390), 'mobile');
  assert.equal(detectDefaultViewportMode(639), 'mobile');
  assert.equal(detectDefaultViewportMode(640), 'tablet');
  assert.equal(detectDefaultViewportMode(820), 'tablet');
  assert.equal(detectDefaultViewportMode(1023), 'tablet');
  assert.equal(detectDefaultViewportMode(1024), 'desktop');
  assert.equal(detectDefaultViewportMode(1440), 'desktop');
  assert.equal(detectDefaultViewportMode(undefined), 'desktop');
  assert.equal(detectDefaultViewportMode(-100), 'desktop');
});

test('parseStoredViewportMode restores valid modes and falls back safely on invalid values', () => {
  assert.equal(parseStoredViewportMode('desktop', 390), 'desktop');
  assert.equal(parseStoredViewportMode('tablet', 1440), 'tablet');
  assert.equal(parseStoredViewportMode('mobile', 1440), 'mobile');
  assert.equal(parseStoredViewportMode('"tablet"', 1440), 'tablet');
  assert.equal(parseStoredViewportMode(null, 1440), 'desktop');
  assert.equal(parseStoredViewportMode(null, 800), 'tablet');
  assert.equal(parseStoredViewportMode(null, 390), 'mobile');
  assert.equal(parseStoredViewportMode('corrupted_mode', 390), 'mobile');
});

test('serializeViewportMode and validation helpers behave deterministically', () => {
  assert.equal(VIEWPORT_MODE_STORAGE_KEY, 'ptg_ppjk_viewport_mode_v1');
  assert.equal(isValidViewportMode('desktop'), true);
  assert.equal(isValidViewportMode('tablet'), true);
  assert.equal(isValidViewportMode('mobile'), true);
  assert.equal(isValidViewportMode('tv'), false);
  assert.equal(serializeViewportMode('tablet'), 'tablet');
});

test('viewport mode configs & cycling provide exact drawer and width metadata', () => {
  assert.deepEqual(VIEWPORT_MODE_ORDER, ['desktop', 'tablet', 'mobile']);
  assert.equal(VIEWPORT_MODE_CONFIGS.desktop.usesDrawerSidebar, false);
  assert.equal(VIEWPORT_MODE_CONFIGS.tablet.usesDrawerSidebar, true);
  assert.equal(VIEWPORT_MODE_CONFIGS.mobile.usesDrawerSidebar, true);

  assert.equal(getViewportModeConfig('tablet').label, 'Tab');
  assert.equal(getViewportModeConfig('mobile').label, 'Mobile (HP)');
  assert.equal(getViewportModeConfig('tablet').targetWidthPx, 820);
  assert.equal(getViewportModeConfig('mobile').targetWidthPx, 412);

  assert.equal(getNextViewportMode('desktop'), 'tablet');
  assert.equal(getNextViewportMode('tablet'), 'mobile');
  assert.equal(getNextViewportMode('mobile'), 'desktop');
});
