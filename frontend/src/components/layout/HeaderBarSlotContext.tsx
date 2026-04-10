'use client';

import { createContext, useContext } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

interface HeaderBarSlotContextValue {
  setHeaderBarSlot: Dispatch<SetStateAction<ReactNode>>;
}

export const HeaderBarSlotContext = createContext<HeaderBarSlotContextValue | null>(null);

export function useHeaderBarSlot() {
  return useContext(HeaderBarSlotContext);
}
