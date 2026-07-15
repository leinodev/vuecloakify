/// <reference types="vite/client" />
import { ftlString, generateFtlWithEnvironment } from "./ftl.js";
import { buildDefaultEnvironment } from "./default-env.js";
import { readVuecloakifyDebug, registerEnvironmentScript } from "./build-context.js";
import type { EnvironmentConfig, EnvironmentSchema, EnvironmentType } from "./types.js";

/** Resolved schema values with an always-available `resourcesPath`. */
export type ResolvedEnvironment<T extends EnvironmentSchema> = EnvironmentType<T> & { resourcesPath: string };

/**
 * Main bridge between Keycloak and the Vue theme application.
 *
 * - During prerendering (SSR), injects a FreeMarker script into `<head>` that
 *   populates `window.ENVIRONMENT` from the Keycloak context.
 * - In the browser, reads the populated `window.ENVIRONMENT` with types inferred
 *   from the schema.
 * - In development, or when `window.ENVIRONMENT` is absent, returns an object
 *   built from the schema's `debug` and `default` values.
 *
 * Always returns a defined object. The SSR output is discarded because the
 * theme renders on the client, so templates do not need optional chaining.
 * `resourcesPath` (`url.resourcesPath`) is added automatically for asset URLs.
 */
export function useEnvironment<T extends EnvironmentSchema>(schema: T): ResolvedEnvironment<T> {
  if (Object.prototype.hasOwnProperty.call(schema, "resourcesPath")) {
    throw new Error("[vuecloakify] \"resourcesPath\" is reserved and must not be declared in the environment schema.");
  }

  // Do not mutate the input schema; callers may reuse it as a constant.
  const config: EnvironmentConfig = {
    ...schema,
    resourcesPath: ftlString({ field: "url.resourcesPath", default: "" }),
  };

  // Installed dependencies can be externalized during Vite SSR. In that case
  // `import.meta.env` is not transformed and is undefined in native Node ESM.
  const viteEnvironment = import.meta.env as Partial<ImportMetaEnv> | undefined;
  const isSsr = viteEnvironment?.SSR ?? typeof window === "undefined";
  const injectedDebug = readVuecloakifyDebug();
  const isDev = viteEnvironment?.DEV ?? injectedDebug ?? false;

  if (isSsr) {
    if (!isDev) {
      registerEnvironmentScript(generateFtlWithEnvironment(config));
    }
    // SSR output is discarded; return defaults so the result is never undefined.
    return buildDefaultEnvironment(config) as ResolvedEnvironment<T>;
  }

  const env = (globalThis as { ENVIRONMENT?: ResolvedEnvironment<T> }).ENVIRONMENT;
  if (env) return env;

  if (!isDev) {
    console.warn("[vuecloakify] window.ENVIRONMENT is not set; using the schema's fallback values.");
  }
  return buildDefaultEnvironment(config) as ResolvedEnvironment<T>;
}
