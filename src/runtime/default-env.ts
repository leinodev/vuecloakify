import type { EnvironmentConfig, EnvironmentType } from "./types.js";
import { isFtlFieldConfig } from "./guards.js";

/**
 * Builds an environment object from schema values when Keycloak has not
 * populated `window.ENVIRONMENT`, such as during local development or as a
 * fallback. Uses `debug ?? default`. This is a dependency-free pure function.
 */
export function buildDefaultEnvironment<T extends EnvironmentConfig>(config: T): EnvironmentType<T> {
  function build(obj: EnvironmentConfig): Record<string, unknown> {
    const entries = Object.entries(obj).map(([key, value]) => {
      let resolved: unknown;
      if (isFtlFieldConfig(value)) {
        const fallback = value.debug !== undefined ? value.debug : value.default;
        switch (value.type) {
          case "string":
            resolved = fallback ?? "";
            break;
          case "number":
            resolved = fallback ?? 0;
            break;
          case "boolean":
            resolved = fallback ?? false;
            break;
          case "string[]":
          case "number[]":
          case "object[]":
            resolved = fallback ?? [];
            break;
        }
      } else {
        resolved = build(value as EnvironmentConfig);
      }

      return [key, resolved] as const;
    });

    // Object.fromEntries defines own data properties, including `__proto__`,
    // without invoking Object.prototype's legacy prototype setter.
    return Object.fromEntries(entries);
  }

  return build(config) as EnvironmentType<T>;
}
