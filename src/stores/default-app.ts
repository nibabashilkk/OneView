import { writable } from "svelte/store";
import type { DefaultAppActionResult, DefaultAppGroupKey, DefaultAppStatus } from "../lib/contracts";
import { getDefaultAppStatus, requestDefaultApp } from "../services/default-app-service";

type DefaultAppState = {
  status: DefaultAppStatus | null;
  loading: boolean;
  actionGroup: DefaultAppGroupKey | null;
  error: string | null;
};

const initialState: DefaultAppState = {
  status: null,
  loading: false,
  actionGroup: null,
  error: null,
};

function createDefaultAppStore() {
  const { subscribe, update, set } = writable<DefaultAppState>(initialState);

  async function refresh(): Promise<DefaultAppStatus> {
    update((state) => ({ ...state, loading: true, error: null }));
    try {
      const status = await getDefaultAppStatus();
      update((state) => ({ ...state, status, loading: false }));
      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      update((state) => ({ ...state, loading: false, error: message }));
      throw error;
    }
  }

  async function request(group: DefaultAppGroupKey): Promise<DefaultAppActionResult> {
    update((state) => ({ ...state, actionGroup: group, error: null }));
    try {
      const result = await requestDefaultApp(group);
      update((state) => ({ ...state, actionGroup: null }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      update((state) => ({ ...state, actionGroup: null, error: message }));
      throw error;
    }
  }

  return {
    subscribe,
    refresh,
    request,
    reset: () => set(initialState),
  };
}

export const defaultApp = createDefaultAppStore();
