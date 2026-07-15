import { createApp } from "vue";
import { createPinia } from "pinia";
import LoginPage from "./theme/login/login.vue";

const app = createApp(LoginPage);
app.use(createPinia());
app.mount("#app");
