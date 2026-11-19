export const CARD_COLLAPSE_STORAGE_KEY = 'ptg_ppjk_collapsed_cards_v1';

export type CollapsedCardsMap = Record<string, boolean>;

export function normalizeCardId(cardId: string): string {
  return String(cardId || '').trim();
}

export function isValidCollapsedCardsMap(value: unknown): value is CollapsedCardsMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return true;
}

export function parseCollapsedCardsMap(rawJson: string | null | undefined): CollapsedCardsMap {
  if (!rawJson || typeof rawJson !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!isValidCollapsedCardsMap(parsed)) return {};
    const sanitized: CollapsedCardsMap = {};
    for (const [key, val] of Object.entries(parsed)) {
      const cleanKey = normalizeCardId(key);
      if (cleanKey && val === true) {
        sanitized[cleanKey] = true;
      }
    }
    return sanitized;
  } catch {
    return {};
  }
}

export function serializeCollapsedCardsMap(map: CollapsedCardsMap): string {
  const compact: CollapsedCardsMap = {};
  for (const [key, val] of Object.entries(map)) {
    const cleanKey = normalizeCardId(key);
    if (cleanKey && val === true) {
      compact[cleanKey] = true;
    }
  }
  return JSON.stringify(compact);
}

export function isCardCollapsedInMap(map: CollapsedCardsMap, cardId: string): boolean {
  const key = normalizeCardId(cardId);
  if (!key) return false;
  return map[key] === true;
}

export function toggleCardCollapsedInMap(
  map: CollapsedCardsMap,
  cardId: string
): CollapsedCardsMap {
  const key = normalizeCardId(cardId);
  if (!key) return map;
  if (map[key] === true) {
    const next = { ...map };
    delete next[key];
    return next;
  }
  return { ...map, [key]: true };
}

export function setCardCollapsedInMap(
  map: CollapsedCardsMap,
  cardId: string,
  collapsed: boolean
): CollapsedCardsMap {
  const key = normalizeCardId(cardId);
  if (!key) return map;
  if (collapsed) {
    if (map[key] === true) return map;
    return { ...map, [key]: true };
  }
  if (map[key] !== true) return map;
  const next = { ...map };
  delete next[key];
  return next;
}

export function setMultipleCardsCollapsedInMap(
  map: CollapsedCardsMap,
  cardIds: readonly string[],
  collapsed: boolean
): CollapsedCardsMap {
  if (!cardIds || cardIds.length === 0) return map;
  const next: CollapsedCardsMap = { ...map };
  let changed = false;

  for (const rawId of cardIds) {
    const key = normalizeCardId(rawId);
    if (!key) continue;
    if (collapsed) {
      if (next[key] !== true) {
        next[key] = true;
        changed = true;
      }
    } else if (next[key] === true) {
      delete next[key];
      changed = true;
    }
  }

  return changed ? next : map;
}

export function countCollapsedCards(
  map: CollapsedCardsMap,
  cardIds: readonly string[]
): number {
  if (!cardIds || cardIds.length === 0) return 0;
  let count = 0;
  const seen = new Set<string>();
  for (const rawId of cardIds) {
    const key = normalizeCardId(rawId);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (map[key] === true) {
      count += 1;
    }
  }
  return count;
}

export function areAllCardsCollapsed(
  map: CollapsedCardsMap,
  cardIds: readonly string[]
): boolean {
  const uniqueKeys = Array.from(
    new Set(cardIds.map((id) => normalizeCardId(id)).filter(Boolean))
  );
  if (uniqueKeys.length === 0) return false;
  return uniqueKeys.every((key) => map[key] === true);
}
