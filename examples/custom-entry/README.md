# Custom entry

This example replaces Vuecloakify's default entry to install Pinia before each
Keycloak page is mounted. The same entry is used for the temporary SSR pass, so
plugins must be SSR-safe.

```bash
pnpm --filter @leinodev/vuecloakify-example-custom-entry dev
pnpm --filter @leinodev/vuecloakify-example-custom-entry build:theme
```

See `src/theme-entry.ts` and the `entryTemplate` option in
`vuecloakify.config.ts`.
