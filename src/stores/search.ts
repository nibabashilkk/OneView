import { writable } from "svelte/store";

export type SearchState = {
  open: boolean;
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  current: number;
  total: number;
};

const initial: SearchState = {
  open: false,
  query: "",
  caseSensitive: false,
  wholeWord: false,
  current: 0,
  total: 0,
};

function createSearchStore() {
  const { subscribe, update, set } = writable<SearchState>(initial);

  return {
    subscribe,
    reset: () => set(initial),
    open: () => update((state) => ({ ...state, open: true })),
    close: () => update((state) => ({ ...state, open: false })),
    setQuery: (query: string) =>
      update((state) => ({ ...state, query, current: 0, total: 0 })),
    toggleCaseSensitive: () =>
      update((state) => ({ ...state, caseSensitive: !state.caseSensitive, current: 0, total: 0 })),
    toggleWholeWord: () =>
      update((state) => ({ ...state, wholeWord: !state.wholeWord, current: 0, total: 0 })),
    report: (total: number) =>
      update((state) => ({
        ...state,
        total,
        current: total === 0 ? 0 : Math.min(state.current, total - 1),
      })),
    next: () =>
      update((state) => ({
        ...state,
        current: state.total === 0 ? 0 : (state.current + 1) % state.total,
      })),
    previous: () =>
      update((state) => ({
        ...state,
        current: state.total === 0 ? 0 : (state.current - 1 + state.total) % state.total,
      })),
  };
}

export const search = createSearchStore();
