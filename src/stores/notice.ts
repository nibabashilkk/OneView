import { writable } from "svelte/store";

export type Notice = {
  id: number;
  message: string;
};

function createNoticeStore() {
  const { subscribe, set } = writable<Notice | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let nextId = 1;
  return {
    subscribe,
    show(message: string, duration = 1600) {
      if (timer) clearTimeout(timer);
      set({ id: nextId++, message });
      timer = setTimeout(() => {
        timer = null;
        set(null);
      }, duration);
    },
    clear() {
      if (timer) clearTimeout(timer);
      timer = null;
      set(null);
    },
  };
}

export const notice = createNoticeStore();
