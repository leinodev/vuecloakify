/**
 * Default theme entry. During the build, `PAGE_COMPONENT_IMPORT` is replaced
 * with the path to a specific page (`login.vue`, `register.vue`, and so on),
 * producing a separate bundle for every page.
 *
 * To install custom plugins (Pinia, i18n, a UI kit) or wrap pages in a layout,
 * copy this file into the project and pass it as `entryTemplate` through
 * `buildKeycloakTheme` or `vuecloakify.config.ts`.
 */
import { createApp, h } from "vue";
// @ts-expect-error The build replaces this placeholder with the page import path.
import PageComponent from "PAGE_COMPONENT_IMPORT";

const app = createApp({ render: () => h(PageComponent) });

if (typeof window !== "undefined") {
  app.mount("#app");
}

// Prerendering imports app so every page setup function can register its environment.
export { app };
