import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areAllCardsCollapsed,
  countCollapsedCards,
  isCardCollapsedInMap,
  parseCollapsedCardsMap,
  serializeCollapsedCardsMap,
  setCardCollapsedInMap,
  setMultipleCardsCollapsedInMap,
  toggleCardCollapsedInMap,
} from './cardCollapseLogic.ts';

test('parseCollapsedCardsMap safely handles empty/corrupted JSON and keeps only true flags', () => {
  assert.deepEqual(parseCollapsedCardsMap(null), {});
  assert.deepEqual(parseCollapsedCardsMap(''), {});
  assert.deepEqual(parseCollapsedCardsMap('not-valid-json'), {});
  assert.deepEqual(parseCollapsedCardsMap('["array"]'), {});
  assert.deepEqual(
    parseCollapsedCardsMap('{"dash-kpi-total":true,"dash-chart-month":false,"  ":true,"do-table":true}'),
    {
      'dash-kpi-total': true,
      'do-table': true,
    }
  );
});

test('serializeCollapsedCardsMap compacts only collapsed cards', () => {
  const serialized = serializeCollapsedCardsMap({
    'card-a': true,
    'card-b': false,
    '': true,
    ' card-c ': true,
  });
  assert.deepEqual(JSON.parse(serialized), {
    'card-a': true,
    'card-c': true,
  });
});

test('toggleCardCollapsedInMap toggles state cleanly and removes false entries', () => {
  let state = {};
  state = toggleCardCollapsedInMap(state, 'dash-chart-month');
  assert.equal(isCardCollapsedInMap(state, 'dash-chart-month'), true);

  state = toggleCardCollapsedInMap(state, 'dash-chart-month');
  assert.equal(isCardCollapsedInMap(state, 'dash-chart-month'), false);
  assert.deepEqual(state, {});
});

test('setCardCollapsedInMap preserves referential identity on no-op updates', () => {
  const initial = { 'card-1': true };
  assert.equal(setCardCollapsedInMap(initial, 'card-1', true), initial);
  assert.equal(setCardCollapsedInMap(initial, 'card-2', false), initial);

  const updated = setCardCollapsedInMap(initial, 'card-2', true);
  assert.deepEqual(updated, { 'card-1': true, 'card-2': true });
  const cleared = setCardCollapsedInMap(updated, 'card-1', false);
  assert.deepEqual(cleared, { 'card-2': true });
});

test('batch collapse & count helpers track unique module card IDs accurately', () => {
  const moduleIds = ['dash-kpi-total', 'dash-chart-month', 'dash-chart-month', 'dash-table'];
  let state = setMultipleCardsCollapsedInMap({}, moduleIds, true);
  assert.equal(countCollapsedCards(state, moduleIds), 3);
  assert.equal(areAllCardsCollapsed(state, moduleIds), true);

  state = toggleCardCollapsedInMap(state, 'dash-chart-month');
  assert.equal(countCollapsedCards(state, moduleIds), 2);
  assert.equal(areAllCardsCollapsed(state, moduleIds), false);

  state = setMultipleCardsCollapsedInMap(state, moduleIds, false);
  assert.equal(countCollapsedCards(state, moduleIds), 0);
  assert.deepEqual(state, {});
});
