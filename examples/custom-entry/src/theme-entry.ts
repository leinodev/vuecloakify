import { createApp, h } from "vue";
import { createPinia } from "pinia";
// @ts-expect-error Vuecloakify replaces this placeholder with the current page import.
import PageComponent from "PAGE_COMPONENT_IMPORT";

const app = createApp({ render: () => h(PageComponent) });
app.use(createPinia());

if (typeof window !== "undefined") {
  app.mount("#app");
}

export { app };
