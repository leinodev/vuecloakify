<script setup lang="ts">
import { ftlFieldErrors, kcLoginContext, useEnvironment } from "@leinodev/vuecloakify";

const env = useEnvironment({
  ...kcLoginContext,
  ...ftlFieldErrors(["username", "password"]),
});
</script>

<template>
  <main class="page-shell">
    <form class="login-card" :action="env.url.loginAction" method="post">
      <h1>{{ env.realm.displayName || "Sign in" }}</h1>

      <p v-if="env.message.summary" class="message" role="alert">
        {{ env.message.summary }}
      </p>

      <label>
        Username
        <input
          name="username"
          autocomplete="username"
          :value="env.login.username"
          :aria-invalid="env.username.hasError"
        />
      </label>
      <small v-if="env.username.hasError">{{ env.username.error }}</small>

      <label>
        Password
        <input name="password" type="password" autocomplete="current-password" />
      </label>
      <small v-if="env.password.hasError">{{ env.password.error }}</small>

      <label v-if="env.realm.rememberMe" class="remember-me">
        <input name="rememberMe" type="checkbox" :checked="env.login.rememberMe" />
        Remember me
      </label>

      <input name="credentialId" type="hidden" :value="env.auth.selectedCredential" />
      <button name="login" type="submit">Sign in</button>

      <a v-if="env.realm.resetPasswordAllowed" :href="env.url.loginResetCredentialsUrl">
        Forgot your password?
      </a>
    </form>
  </main>
</template>

<style>
:root {
  color: #18212f;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: #eef2f7;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.page-shell {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 2rem;
}

.login-card {
  display: grid;
  width: min(100%, 26rem);
  gap: 1rem;
  padding: 2rem;
  border-radius: 1rem;
  background: white;
  box-shadow: 0 1rem 3rem rgb(24 33 47 / 12%);
}

label:not(.remember-me) {
  display: grid;
  gap: 0.4rem;
  font-weight: 600;
}

input:not([type="checkbox"]),
button {
  min-height: 2.75rem;
  border: 1px solid #c8d1df;
  border-radius: 0.55rem;
  padding: 0.65rem 0.8rem;
  font: inherit;
}

button {
  border-color: #315efb;
  color: white;
  background: #315efb;
  cursor: pointer;
}

.message,
small {
  color: #b42318;
}
</style>
