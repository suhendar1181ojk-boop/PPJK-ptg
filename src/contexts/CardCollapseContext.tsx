import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CARD_COLLAPSE_STORAGE_KEY,
  CollapsedCardsMap,
  areAllCardsCollapsed,
  countCollapsedCards,
  isCardCollapsedInMap,
  parseCollapsedCardsMap,
  serializeCollapsedCardsMap,
  setCardCollapsedInMap,
  setMultipleCardsCollapsedInMap,
  toggleCardCollapsedInMap,
} from '../utils/cardCollapseLogic';

interface CardCollapseContextValue {
  collapsedMap: CollapsedCardsMap;
  isCollapsed: (cardId: string) => boolean;
  toggleCard: (cardId: string) => void;
  setCardCollapsed: (cardId: string, collapsed: boolean) => void;
  setMultipleCollapsed: (cardIds: readonly string[], collapsed: boolean) => void;
  countCollapsed: (cardIds: readonly string[]) => number;
  areAllCollapsed: (cardIds: readonly string[]) => boolean;
  resetAllCollapsed: () => void;
}

const fallbackContext: CardCollapseContextValue = {
  collapsedMap: {},
  isCollapsed: () => false,
  toggleCard: () => {},
  setCardCollapsed: () => {},
  setMultipleCollapsed: () => {},
  countCollapsed: () => 0,
  areAllCollapsed: () => false,
  resetAllCollapsed: () => {},
};

const CardCollapseContext = createContext<CardCollapseContextValue>(fallbackContext);

function readStoredMap(): CollapsedCardsMap {
  if (typeof window === 'undefined') return {};
  try {
    return parseCollapsedCardsMap(window.localStorage.getItem(CARD_COLLAPSE_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function CardCollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsedMap, setCollapsedMap] = useState<CollapsedCardsMap>(readStoredMap);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CARD_COLLAPSE_STORAGE_KEY,
        serializeCollapsedCardsMap(collapsedMap)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [collapsedMap]);

  const isCollapsed = useCallback(
    (cardId: string) => isCardCollapsedInMap(collapsedMap, cardId),
    [collapsedMap]
  );

  const toggleCard = useCallback((cardId: string) => {
    setCollapsedMap((prev) => toggleCardCollapsedInMap(prev, cardId));
  }, []);

  const setCardCollapsed = useCallback((cardId: string, collapsed: boolean) => {
    setCollapsedMap((prev) => setCardCollapsedInMap(prev, cardId, collapsed));
  }, []);

  const setMultipleCollapsed = useCallback(
    (cardIds: readonly string[], collapsed: boolean) => {
      setCollapsedMap((prev) => setMultipleCardsCollapsedInMap(prev, cardIds, collapsed));
    },
    []
  );

  const countCollapsed = useCallback(
    (cardIds: readonly string[]) => countCollapsedCards(collapsedMap, cardIds),
    [collapsedMap]
  );

  const areAllCollapsed = useCallback(
    (cardIds: readonly string[]) => areAllCardsCollapsed(collapsedMap, cardIds),
    [collapsedMap]
  );

  const resetAllCollapsed = useCallback(() => {
    setCollapsedMap({});
  }, []);

  const value = useMemo<CardCollapseContextValue>(
    () => ({
      collapsedMap,
      isCollapsed,
      toggleCard,
      setCardCollapsed,
      setMultipleCollapsed,
      countCollapsed,
      areAllCollapsed,
      resetAllCollapsed,
    }),
    [
      collapsedMap,
      isCollapsed,
      toggleCard,
      setCardCollapsed,
      setMultipleCollapsed,
      countCollapsed,
      areAllCollapsed,
      resetAllCollapsed,
    ]
  );

  return (
    <CardCollapseContext.Provider value={value}>{children}</CardCollapseContext.Provider>
  );
}

export function useCardCollapse(): CardCollapseContextValue {
  return useContext(CardCollapseContext);
}
