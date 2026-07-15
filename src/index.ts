/**
 * Runtime entry point for `@leinodev/vuecloakify`.
 *
 * Build a Keycloak theme as a regular Vue application and prerender it into
 * FreeMarker templates (`*.ftl`) at build time. Theme pages import this module;
 * the build pipeline is exposed by `@leinodev/vuecloakify/build`.
 */
export * from "./runtime/index.js";
