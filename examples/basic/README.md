# Basic login theme

This is the smallest complete Vuecloakify project. It supports a normal Vite
preview and emits an installable Keycloak login theme.

From the repository root:

```bash
pnpm install
pnpm --filter @leinodev/vuecloakify-example-basic dev
pnpm --filter @leinodev/vuecloakify-example-basic build:theme
```

The production theme is written to `dist/`. Mount that directory as
`/opt/keycloak/themes/my-theme` or package it in a Keycloak theme provider JAR.
