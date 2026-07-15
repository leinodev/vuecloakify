/**
 * Runtime API imported by Vue theme pages.
 *
 * @example
 * ```ts
 * import { useEnvironment, kcLoginContext, ftlFieldErrors } from "@leinodev/vuecloakify";
 *
 * const env = useEnvironment({
 *   ...kcLoginContext,
 *   ...ftlFieldErrors(["username", "password"]),
 * });
 * // env.realm.registrationAllowed: boolean and env.username.error: string are fully typed.
 * ```
 */
export { useEnvironment } from "./environment.js";
export type { ResolvedEnvironment } from "./environment.js";
export { buildDefaultEnvironment } from "./default-env.js";
export {
  ftlString,
  ftlNumber,
  ftlBoolean,
  ftlStringArray,
  ftlNumberArray,
  ftlObjectArray,
  generateFtlWithEnvironment,
} from "./ftl.js";
export { kcLoginContext, kcSocialProviders, ftlFieldErrors } from "./context.js";
export { fixResourcesPath } from "./resources.js";
export type {
  EnvironmentConfig,
  EnvironmentSchema,
  EnvironmentType,
  FtlBaseConfig,
  FtlBooleanConfig,
  FtlFieldType,
  FtlNumberArrayConfig,
  FtlNumberConfig,
  FtlObjectArrayConfig,
  FtlStringArrayConfig,
  FtlStringConfig,
  FtlTypeMapping,
} from "./types.js";
