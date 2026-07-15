<script setup lang="ts">
import { kcLoginContext, useEnvironment } from "@leinodev/vuecloakify";
import { useAppearanceStore } from "../../stores/appearance";

const env = useEnvironment(kcLoginContext);
const appearance = useAppearanceStore();
</script>

<template>
  <main :class="{ compact: appearance.compact }">
    <form :action="env.url.loginAction" method="post">
      <h1>{{ env.realm.displayName || "Welcome" }}</h1>
      <input name="username" autocomplete="username" placeholder="Username" />
      <input name="password" type="password" autocomplete="current-password" placeholder="Password" />
      <button name="login" type="submit">Sign in</button>
      <button type="button" @click="appearance.compact = !appearance.compact">
        Toggle spacing
      </button>
    </form>
  </main>
</template>

<style>
main {
  display: grid;
  min-height: 100vh;
  place-items: center;
  background: #111827;
}

form {
  display: grid;
  gap: 1rem;
  width: min(24rem, calc(100% - 2rem));
  padding: 2rem;
  border-radius: 1rem;
  background: white;
}

.compact form {
  gap: 0.4rem;
}

input,
button {
  padding: 0.75rem;
}
</style>
