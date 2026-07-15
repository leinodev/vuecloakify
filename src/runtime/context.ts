import { ftlString, ftlBoolean, ftlObjectArray } from "./ftl.js";
import type { EnvironmentConfig } from "./types.js";

/**
 * Ready-to-use schema for the standard Keycloak login theme context. Spread it
 * into a page schema instead of declaring every FreeMarker path manually:
 *
 * ```ts
 * const env = useEnvironment({ ...kcLoginContext, ...ftlFieldErrors(["username", "password"]) });
 * env.realm.registrationAllowed; // boolean, with autocomplete
 * ```
 *
 * `debug` values populate the development preview without Keycloak.
 */
export const kcLoginContext = {
  url: {
    loginAction: ftlString({ field: "url.loginAction", debug: "#" }),
    loginUrl: ftlString({ field: "url.loginUrl", debug: "#" }),
    registrationUrl: ftlString({ field: "url.registrationUrl", debug: "#" }),
    loginResetCredentialsUrl: ftlString({ field: "url.loginResetCredentialsUrl", debug: "#" }),
    loginRestartFlowUrl: ftlString({ field: "url.loginRestartFlowUrl", debug: "#" }),
    resourcesPath: ftlString({ field: "url.resourcesPath", debug: "" }),
  },
  realm: {
    name: ftlString({ field: "realm.name", debug: "example" }),
    displayName: ftlString({ field: "realm.displayName", debug: "Example" }),
    registrationAllowed: ftlBoolean({ field: "realm.registrationAllowed", debug: true }),
    rememberMe: ftlBoolean({ field: "realm.rememberMe", debug: true }),
    resetPasswordAllowed: ftlBoolean({ field: "realm.resetPasswordAllowed", debug: true }),
    loginWithEmailAllowed: ftlBoolean({ field: "realm.loginWithEmailAllowed", debug: true }),
    registrationEmailAsUsername: ftlBoolean({ field: "realm.registrationEmailAsUsername", debug: false }),
    password: ftlBoolean({ field: "realm.password", debug: true }),
    internationalizationEnabled: ftlBoolean({ field: "realm.internationalizationEnabled", debug: true }),
  },
  message: {
    type: ftlString({ field: "message.type", debug: "" }),
    summary: ftlString({ field: "message.summary", debug: "" }),
  },
  locale: {
    current: ftlString({ field: "locale.currentLanguageTag", default: "en", debug: "en" }),
  },
  login: {
    username: ftlString({ field: "login.username", debug: "" }),
    rememberMe: ftlBoolean({ field: "login.rememberMe", debug: false }),
  },
  auth: {
    selectedCredential: ftlString({ field: "auth.selectedCredential", debug: "" }),
  },
  client: {
    baseUrl: ftlString({ field: "client.baseUrl", debug: "#" }),
  },
} satisfies EnvironmentConfig;

/**
 * Keycloak social providers (`social.providers`) represented as an object array.
 * Add it under a dedicated key: `useEnvironment({ ...kcLoginContext, social: kcSocialProviders })`.
 */
export const kcSocialProviders = ftlObjectArray({
  field: "social.providers",
  debug: [],
  itemConfig: {
    alias: ftlString({ field: "alias" }),
    displayName: ftlString({ field: "displayName" }),
    loginUrl: ftlString({ field: "loginUrl" }),
    iconClasses: ftlString({ field: "iconClasses" }),
  },
});

/** The `{ error, hasError }` schema for one field. A type alias keeps it compatible with `EnvironmentConfig`. */
type FieldErrorSchema = {
  /** Field error text from `messagesPerField.get(name)`, or an empty string when no error exists. */
  error: ReturnType<typeof ftlString>;
  /** Whether the field has an error, from `messagesPerField.existsError(name)`. */
  hasError: ReturnType<typeof ftlBoolean>;
};

type FieldErrorsSchema<F extends string> = { [K in F]: FieldErrorSchema };

function quoteFtlString(value: string): string {
  return `'${value
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n")
    .replaceAll("${", "$\\{")
    .replaceAll("#{", "#\\{")
    .replaceAll("[=", "[\\=")}'`;
}

/**
 * Creates a form-field validation schema from `messagesPerField`. Generates
 * `{ error, hasError }` for every field name:
 *
 * ```ts
 * const env = useEnvironment({ ...kcLoginContext, ...ftlFieldErrors(["username", "password"]) });
 * env.username.hasError; // boolean
 * env.username.error;    // string (escaped with ?js_string during the build)
 * ```
 */
export function ftlFieldErrors<const F extends readonly string[]>(fields: F): FieldErrorsSchema<F[number]> {
  const entries = fields.map((name) => {
    const ftlName = quoteFtlString(name);
    return [name, {
      error: ftlString({ field: `messagesPerField.get(${ftlName})`, debug: "" }),
      hasError: ftlBoolean({ field: `messagesPerField.existsError(${ftlName})`, debug: false }),
    }] as const;
  });

  // Object.fromEntries preserves field names such as `__proto__` as own data
  // properties instead of invoking the legacy prototype setter.
  return Object.fromEntries(entries) as FieldErrorsSchema<F[number]>;
}
