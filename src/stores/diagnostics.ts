import { writable } from "svelte/store";

export type DiagnosticSource = "window" | "promise" | "app" | "plugins" | `plugin:${string}`;

export type DiagnosticEntry = {
  at: number;
  source: DiagnosticSource;
  message: string;
};

const MAX_ENTRIES = 20;

function createDiagnosticsStore() {
  const { subscribe, update, set } = writable<DiagnosticEntry[]>([]);
  return {
    subscribe,
    push(source: DiagnosticEntry["source"], value: unknown) {
      const message = value instanceof Error ? `${value.name}: ${value.message}` : String(value);
      update((entries) => [{ at: Date.now(), source, message }, ...entries].slice(0, MAX_ENTRIES));
    },
    clear: () => set([]),
  };
}

export const diagnostics = createDiagnosticsStore();
