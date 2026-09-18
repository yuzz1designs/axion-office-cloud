function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

/** AIVA is opt-in during the web launch. It must never start from stored user state. */
const environment = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
export const AIVA_ENABLED = enabled(environment?.VITE_AIVA_ENABLED);
