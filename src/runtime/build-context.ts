/** Shared process-wide channel used by the builder and an externalized runtime. */
export const VUECLOAKIFY_BUILD_CONTEXT = Symbol.for("vuecloakify.build-context");

/** State scoped to one SSR page render. */
export interface VuecloakifyBuildState {
  debug: boolean;
  environmentScripts: string[];
}

/** Browser-safe shape implemented by Node's AsyncLocalStorage in the builder. */
export interface VuecloakifyBuildContextChannel {
  getStore(): VuecloakifyBuildState | undefined;
}

function readBuildState(): VuecloakifyBuildState | undefined {
  const value = (globalThis as typeof globalThis & Record<symbol, unknown>)[VUECLOAKIFY_BUILD_CONTEXT];
  if (typeof value !== "object" || value === null) return undefined;

  const getStore = (value as Partial<VuecloakifyBuildContextChannel>).getStore;
  if (typeof getStore !== "function") return undefined;
  return getStore.call(value);
}

/** Returns the build's debug state when the runtime executes inside Vuecloakify SSR. */
export function readVuecloakifyDebug(): boolean | undefined {
  return readBuildState()?.debug;
}

/** Adds a generated environment assignment to the page currently being rendered. */
export function registerEnvironmentScript(script: string): void {
  readBuildState()?.environmentScripts.push(script);
}
