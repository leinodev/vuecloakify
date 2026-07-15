# Vuecloakify

Build type-safe Keycloak themes with Vue 3.

Write each login screen as a Vue single-file component, describe the Keycloak
FreeMarker values it needs with a type-safe schema, and compile the project into
a conventional Keycloak theme directory. Optional email templates are compiled
from MJML. Keycloak itself does not need to be running during the build.
Runtime helpers are exported from `@leinodev/vuecloakify`; build tooling is
exported from `@leinodev/vuecloakify/build`.

> Vuecloakify is an independent project and is not affiliated with Keycloak or
> the Keycloakify project.

## Features

- Vue 3 single-file components for Keycloak login pages
- Inferred TypeScript types for values from the Keycloak FreeMarker context
- Production fallbacks and realistic debug values declared in the same schema
- Separate client bundles for every Keycloak page
- Generated JS/CSS and non-inlined imports emitted under the theme's
  `resources/` (Vite may inline small assets)
- Optional MJML-to-FreeMarker compilation for HTML email templates
- Static files, message bundles, and `theme.properties` copied as-is
- Config-file, CLI, and programmatic build APIs
- No Keycloak-specific server plugin: the output is a regular theme directory

## How it works

```text
src/theme/login/login.vue
          │
          │ Vite client build + temporary SSR build
          ▼
dist/login/login.ftl ────────► Keycloak evaluates FreeMarker expressions
          │                                      │
          │ contains a small environment script  │ returns HTML + JS + CSS
          ▼                                      ▼
window.ENVIRONMENT ◄──────── Vue mounts the selected login page in the browser
```

For each top-level `*.vue` file in the login source directory, the builder:

1. creates a temporary entry module;
2. builds a browser bundle and an SSR bundle with the consumer's Vite plugins
   and transformation settings;
3. performs an SSR pass to collect the FTL environment declared by
   `useEnvironment`;
4. writes a matching `*.ftl` file and its assets.

The rendered Vue body is intentionally discarded. Keycloak evaluates the
generated FreeMarker environment script first, then the browser mounts Vue into
`#app`. Consequently, a generated login theme requires JavaScript.

The temporary SSR pass still executes each component's setup function and
render function. Theme pages and plugins must therefore be SSR-safe: guard
direct access to `window` or `document`, or move browser-only work to
`onMounted`. Declare the page's complete environment with one unconditional
`useEnvironment` call at page setup level. A call hidden in a conditional child
component may not run during the build, so its fields may be missing from the
generated FTL environment.

## Requirements

- Node.js 20.19+ (20.x), or 22.12+
- Vue 3.5 or later
- Vite 5, 6, or 7
- `@vitejs/plugin-vue` configured in the theme project's Vite config
- TypeScript 5.0 or later when consuming the declarations; this repository is
  built and tested with TypeScript 6
- MJML 4.15 or later only when building email templates

The package is distributed as ESM. Theme projects should use ESM as well, for
example by setting `"type": "module"` in `package.json`.

The FreeMarker context is controlled by Keycloak and can change between
Keycloak releases. The built-in schema covers commonly used login-theme values;
test the generated theme against the same Keycloak version you deploy. Page-name
validation is advisory and intentionally does not claim compatibility with a
specific Keycloak release.

## Installation

With pnpm:

```bash
pnpm add @leinodev/vuecloakify vue
pnpm add -D vite @vitejs/plugin-vue
```

With npm:

```bash
npm install @leinodev/vuecloakify vue
npm install --save-dev vite @vitejs/plugin-vue
```

Add `mjml` when the theme contains `src/theme/email/*.mjml` files:

```bash
pnpm add -D mjml
```

## Examples

- [`examples/basic`](./examples/basic) is a minimal theme with a Vite preview,
  a typed login page, validation errors, static metadata, and messages.
- [`examples/custom-entry`](./examples/custom-entry) shows how to install Pinia
  with a custom entry while keeping the production and SSR paths identical.

Clone the repository, run `pnpm install`, then use `pnpm examples:check` to type
check and build both examples.

## Quick start

### 1. Create the project structure

```text
my-keycloak-theme/
├── public/
│   └── login/
│       ├── messages/
│       │   └── messages_en.properties
│       └── theme.properties
├── src/
│   └── theme/
│       └── login/
│           └── login.vue
├── vuecloakify.config.ts
├── package.json
└── vite.config.ts
```

Only top-level `*.vue` files in `src/theme/login` are treated as Keycloak
pages. Keep shared components in another directory, for example
`src/components`.

### 2. Configure Vite

The theme builder loads the Vite config from the project root. This is how it
gets Vue SFC support as well as project aliases, CSS settings, `define` values,
and other Vite plugins. The builder owns the actual client and SSR builds, so
the consumer config's entire `build` section, plus `builder` and `environments`,
is intentionally ignored. The builder also owns `ssr.target`, `ssr.external`,
and `ssr.noExternal`: the temporary SSR output targets Node and is
self-contained even when `tempDir` is outside the project. This isolates the
managed output, temporary bundle, and client manifest: consumer output paths,
entries, library/SSR mode, writing, watching, manifests, and Rollup
external/output settings cannot redirect or disable the theme build. Worker
plugins and format are retained, but worker `rollupOptions` are not. Vite's
default asset inlining threshold applies; small imports may become data URLs
instead of separate `resources/` files.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
});
```

### 3. Create a login page

```vue
<!-- src/theme/login/login.vue -->
<script setup lang="ts">
import {
  ftlFieldErrors,
  kcLoginContext,
  useEnvironment,
} from "@leinodev/vuecloakify";

const env = useEnvironment({
  ...kcLoginContext,
  ...ftlFieldErrors(["username", "password"]),
});
</script>

<template>
  <main>
    <p v-if="env.message.summary" role="alert" :data-type="env.message.type">
      {{ env.message.summary }}
    </p>

    <form :action="env.url.loginAction" method="post">
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

      <label v-if="env.realm.rememberMe">
        <input name="rememberMe" type="checkbox" :checked="env.login.rememberMe" />
        Remember me
      </label>

      <input name="credentialId" type="hidden" :value="env.auth.selectedCredential" />
      <button name="login" type="submit">Sign in</button>
    </form>

    <a v-if="env.realm.resetPasswordAllowed" :href="env.url.loginResetCredentialsUrl">
      Forgot password?
    </a>
  </main>
</template>
```

`useEnvironment` returns a defined, type-inferred object in production, during
the temporary SSR pass, and in a local preview. Optional chaining is therefore
not needed for fields declared by the schema.

### 4. Add Keycloak theme metadata

```properties
# public/login/theme.properties
parent=keycloak
locales=en
```

Everything inside `public/` is copied into the root of the generated theme.
Use it for `theme.properties`, message bundles, and other files that should not
go through Vite.

### 5. Configure and run the build

```ts
// vuecloakify.config.ts
import { defineConfig } from "@leinodev/vuecloakify/build";

export default defineConfig({
  themeSource: "src/theme",
  outDir: "dist",
});
```

```json
{
  "type": "module",
  "scripts": {
    "build:theme": "vuecloakify",
    "build:theme:debug": "vuecloakify --debug"
  }
}
```

```bash
pnpm build:theme
```

The result is a Keycloak theme directory:

```text
dist/
└── login/
    ├── messages/
    │   └── messages_en.properties
    ├── resources/
    │   ├── login-entry-<hash>.js
    │   └── ...
    ├── login.ftl
    └── theme.properties
```

> **Important:** every build recursively deletes `outDir` and `tempDir` before
> writing them. Use dedicated directories. The builder rejects filesystem
> roots, the project root or its ancestors, directories overlapping
> `themeSource`/`loginDir`/`emailDir`/`publicDir` (including symlinked paths),
> and overlapping output and temporary directories.

### 6. Install the theme in Keycloak

Place the generated directory at `<keycloak>/themes/<theme-name>`, or mount it
there in a container:

```text
<keycloak>/themes/my-theme/login/login.ftl
<keycloak>/themes/my-theme/login/theme.properties
```

Then select `my-theme` as the realm's login theme. Packaging the same directory
inside a Keycloak theme provider JAR is also possible; no package-specific
runtime is required on the Keycloak server.

## Describing the Keycloak environment

An environment schema is a nested object whose leaves are FreeMarker field
descriptors. `useEnvironment` infers the returned TypeScript type from that
schema.

```ts
import {
  ftlBoolean,
  ftlNumber,
  ftlObjectArray,
  ftlString,
  ftlStringArray,
  useEnvironment,
} from "@leinodev/vuecloakify";

const env = useEnvironment({
  realmName: ftlString({
    field: "realm.name",
    default: "unknown",
    debug: "local-development",
  }),
  attemptsRemaining: ftlNumber({
    field: "attemptsRemaining",
    default: 0,
    debug: 3,
  }),
  required: ftlBoolean({
    field: "required",
    default: false,
    debug: true,
  }),
  roles: ftlStringArray({
    field: "roles",
    default: [],
    debug: ["user"],
  }),
  providers: ftlObjectArray({
    field: "social.providers",
    debug: [{ alias: "github", loginUrl: "#" }],
    itemConfig: {
      alias: ftlString({ field: "alias" }),
      loginUrl: ftlString({ field: "loginUrl" }),
    },
  }),
});

env.realmName; // string
env.attemptsRemaining; // number
env.required; // boolean
env.roles; // string[]
env.providers; // Array<{ alias: string; loginUrl: string }>
```

Each field option has a distinct purpose:

| Option | Meaning |
| --- | --- |
| `field` | A literal FreeMarker expression evaluated by Keycloak, such as `realm.name`. |
| `default` | Value emitted when the FreeMarker expression has no content in a production theme. |
| `debug` | Value used when no Keycloak environment exists, including debug builds and local Vite previews. It takes precedence over `default` outside Keycloak. |
| `formatItem` | Optional FreeMarker mapping expression for each item of a string or number array. |
| `itemConfig` | Nested schema describing one item of an object array. |

Schema definitions are build-time source code and `field`/`formatItem` values are
inserted into generated FreeMarker. Never construct them from untrusted input.
Runtime strings are escaped with FreeMarker's `?js_string` before they are
placed in the environment script.

### Built-in login context

`kcLoginContext` provides these commonly used values:

| Group | Fields |
| --- | --- |
| `url` | `loginAction`, `loginUrl`, `registrationUrl`, `loginResetCredentialsUrl`, `loginRestartFlowUrl`, `resourcesPath` |
| `realm` | `name`, `displayName`, `registrationAllowed`, `rememberMe`, `resetPasswordAllowed`, `loginWithEmailAllowed`, `registrationEmailAsUsername`, `password`, `internationalizationEnabled` |
| `message` | `type`, `summary` |
| `locale` | `current` |
| `login` | `username`, `rememberMe` |
| `auth` | `selectedCredential` |
| `client` | `baseUrl` |

Spread it into a page schema and add page-specific fields next to it:

```ts
const env = useEnvironment({
  ...kcLoginContext,
  registrationAction: ftlString({
    field: "url.registrationAction",
    debug: "#",
  }),
});
```

The schema intentionally contains only a useful common subset. Keycloak pages
expose different context values, so declare page-specific values explicitly.

### Field validation errors

`ftlFieldErrors` maps Keycloak's `messagesPerField` API to `{ error, hasError }`
objects while preserving literal field names in the inferred type:

```ts
const env = useEnvironment({
  ...ftlFieldErrors(["username", "password-confirm"]),
});

env.username.hasError; // boolean
env["password-confirm"].error; // string
```

The field names become quoted FreeMarker arguments, so pass constant names from
the form rather than user-controlled strings.

### Social identity providers

`kcSocialProviders` maps `social.providers` to an array containing `alias`,
`displayName`, `loginUrl`, and `iconClasses`:

```ts
const env = useEnvironment({
  ...kcLoginContext,
  social: kcSocialProviders,
});
```

### Resource paths

`useEnvironment` always adds a top-level `resourcesPath` containing
`url.resourcesPath`. Imported assets and generated JS/CSS URLs are rewritten by
the builder automatically. The top-level `resourcesPath` key is reserved and
must not be redefined in a custom schema. Prefer Vite imports for assets used by
components:

```vue
<script setup lang="ts">
import logoUrl from "../assets/logo.svg";
</script>

<template>
  <img :src="logoUrl" alt="Example" />
</template>
```

`fixResourcesPath(debug, path, basePath)` is exported for custom build tooling,
but ordinary theme components do not need to call it.

## Debugging and local previews

Run a debug build to emit `*.html` instead of `*.ftl` and use each schema's
`debug` values:

```bash
vuecloakify --debug
```

The builder always resolves the consumer Vite config in `production` mode for
deterministic output. It explicitly sets `import.meta.env.DEV=true` and
`import.meta.env.PROD=false` for `--debug`; a normal build uses the inverse. Use
those booleans, rather than `import.meta.env.MODE`, for preview-only branches.

Serve the output directory as its root and open a page such as
`/login/login.html`. Do not open the file directly with a `file://` URL because
module scripts and absolute resource URLs require an HTTP server.

You can also create a normal Vite development entry that renders any page or a
page picker. When `import.meta.env.DEV` is true and Keycloak has not populated
`window.ENVIRONMENT`, `useEnvironment` returns `debug ?? default` values. The
package deliberately does not impose a development router or preview UI.

In a non-debug browser build, a missing `window.ENVIRONMENT` produces a warning
and falls back to the schema's `debug ?? default` values. If that happens in
Keycloak, inspect the generated FTL and verify that the page calls
`useEnvironment` during setup.

## Build configuration

The CLI reads the first existing config file from the project root:

1. `vuecloakify.config.ts`
2. `vuecloakify.config.mts`
3. `vuecloakify.config.mjs`
4. `vuecloakify.config.js`
5. `vuecloakify.config.cts`
6. `vuecloakify.config.cjs`

CLI flags override values from the config file:

| Flag | Behavior |
| --- | --- |
| `--config <file>` | Load an explicit config path instead of searching for a default filename. |
| `--debug` | `debug: true` |
| `--out <directory>` | `outDir` |
| `--source <directory>` | `themeSource` |
| `--no-validate` | `validatePageNames: false` |
| `-h`, `--help` | Print usage information. |
| `-v`, `--version` | Print the installed package version. |

`--config`, `--out`, and `--source` also accept `--flag=value` syntax. Unknown
CLI flags and unknown config keys are treated as errors.

### `BuildKeycloakThemeOptions`

| Option | Default | Description |
| --- | --- | --- |
| `cwd` | `process.cwd()` | Project root. Relative paths are resolved from here. |
| `themeSource` | `src/theme` | Directory containing the login and email source directories. |
| `loginDir` | `login` | Login source directory relative to `themeSource`; set to `null` to skip login pages. |
| `emailDir` | `email` | Email source directory relative to `themeSource`; set to `null` to skip email templates. |
| `publicDir` | `public` | Static directory copied into `outDir`; set to `null` to skip it. |
| `outDir` | `dist` | Generated Keycloak theme directory. It is deleted before every build. |
| `tempDir` | `.vuecloakify` | Temporary entries and SSR bundles. It is recreated before a build and removed when the build finishes. |
| `htmlTemplate` | built-in template | Path relative to `cwd`, or the template source itself. |
| `entryTemplate` | built-in template | Path relative to `cwd`, or the entry-module source itself. |
| `debug` | `false` | Emit debug HTML and use schema debug values instead of emitting FTL pages. |
| `validatePageNames` | `true` | Warn about page names not recognized as standard Keycloak templates. |

The static directory is copied after generated files are written. A file in
`public/` with the same output path will overwrite the generated file.

### Programmatic build

```ts
import { fileURLToPath } from "node:url";
import { buildKeycloakTheme } from "@leinodev/vuecloakify/build";

await buildKeycloakTheme({
  cwd: fileURLToPath(new URL(".", import.meta.url)),
  themeSource: "src/theme",
  outDir: "dist",
  emailDir: null,
});
```

`buildKeycloakTheme` returns `Promise<void>` and rejects when Vite or filesystem
operations fail.

## Custom page and entry templates

Use `htmlTemplate` to control the outer document. A custom HTML template must
retain the `headTags`, `cssLinks`, and `clientScriptPath` markers. The remaining
markers are optional insertion points and are replaced with empty strings by
the built-in renderer:

```html
<!doctype html>
<html<!--htmlAttrs-->>
  <head>
    <!--headTags-->
    <!--cssLinks-->
  </head>
  <body<!--bodyAttrs-->>
    <!--bodyTagsOpen-->
    <div id="app"><!--appHtml--></div>
    <script type="module" src="<!--clientScriptPath-->"></script>
    <!--bodyTags-->
  </body>
</html>
```

The template itself may contain FreeMarker, for example a locale-dependent
`lang` attribute.

Use `entryTemplate` to install Pinia, i18n, a router, or a common layout. The
entry source must:

- contain the exact `PAGE_COMPONENT_IMPORT` placeholder in the page import;
- create a Vue app for that page;
- mount to `#app` only in the browser;
- export `app` for the temporary SSR pass.

Declare every package imported by a custom entry (for example `pinia`) as a
direct dependency or dev dependency of the theme project's `package.json`.
Generated entries may live outside the project when an absolute `tempDir` is
used, so the builder uses that manifest to resolve bare imports from the
project root. Vite aliases and plugin-provided modules continue to work.

The built-in entry follows this contract:

```ts
import { createApp, h } from "vue";
import PageComponent from "PAGE_COMPONENT_IMPORT";

const app = createApp({ render: () => h(PageComponent) });

if (typeof window !== "undefined") {
  app.mount("#app");
}

export { app };
```

`useEnvironment` communicates with the builder directly; custom entries do not
need a head-management plugin.

## Email themes

Email support is optional. Add top-level MJML files to `src/theme/email`:

```text
src/theme/email/password-reset.mjml
public/email/theme.properties
public/email/text/password-reset.ftl
```

With `mjml` installed, the default build writes:

```text
dist/email/html/password-reset.ftl
dist/email/theme.properties
dist/email/text/password-reset.ftl
```

FreeMarker expressions in text and attributes are preserved for Keycloak to
evaluate. Wrap FreeMarker directives that look like markup, such as `<#if>`,
in [`<mj-raw>`](https://documentation.mjml.io/#mj-raw) so MJML's strict
validator does not interpret them as MJML elements. The package currently
compiles HTML email templates only; provide plain-text templates and email
theme metadata through `public/`. If no MJML files exist, or `emailDir` is
`null`, this step is skipped. If MJML files exist but the optional `mjml` peer
is not installed, the build fails with an actionable error rather than
producing an incomplete email theme.

## Page names

Keycloak selects templates by filename. Name Vue files after the corresponding
Keycloak template, for example:

```text
login.vue                  → login.ftl
register.vue               → register.ftl
login-reset-password.vue   → login-reset-password.ftl
login-otp.vue              → login-otp.ftl
error.vue                  → error.ftl
info.vue                   → info.ftl
```

Unknown names produce warnings by default because Keycloak normally will not
select those files. The check is advisory and version-dependent. Set
`validatePageNames: false` for intentionally custom templates, but note that
every top-level `*.vue` file in the login directory is still built as a page.

## Public API

### Runtime: `@leinodev/vuecloakify`

| Export | Description |
| --- | --- |
| `useEnvironment(schema)` | Register the FTL environment during SSR and return the resolved, inferred environment. |
| `kcLoginContext` | Schema for commonly used Keycloak login context values. |
| `kcSocialProviders` | Object-array descriptor for `social.providers`. |
| `ftlFieldErrors(fields)` | Create `error` and `hasError` descriptors backed by `messagesPerField`. |
| `ftlString(config)` | Create a string descriptor. |
| `ftlNumber(config)` | Create a number descriptor. |
| `ftlBoolean(config)` | Create a boolean descriptor. |
| `ftlStringArray(config)` | Create a string-array descriptor. |
| `ftlNumberArray(config)` | Create a number-array descriptor. |
| `ftlObjectArray(config)` | Create an object-array descriptor with an inferred item type. |
| `buildDefaultEnvironment(schema)` | Resolve a schema from `debug ?? default` values without Keycloak. |
| `generateFtlWithEnvironment(schema)` | Generate the low-level FTL assignment for `window.ENVIRONMENT`. |
| `fixResourcesPath(debug, path, basePath)` | Rewrite an emitted asset path for Keycloak or a debug build. |

Exported runtime types:

- `EnvironmentConfig`
- `EnvironmentSchema`
- `EnvironmentType<T>`
- `ResolvedEnvironment<T>`
- `FtlBaseConfig`
- `FtlStringConfig`
- `FtlNumberConfig`
- `FtlBooleanConfig`
- `FtlStringArrayConfig`
- `FtlNumberArrayConfig`
- `FtlFieldType`
- `FtlObjectArrayConfig<T>`
- `FtlTypeMapping<T>`

### Build: `@leinodev/vuecloakify/build`

| Export | Description |
| --- | --- |
| `buildKeycloakTheme(options?)` | Build login pages, email templates, and static files. |
| `defineConfig(options)` | Return typed build options for a config file. |
| `BuildKeycloakThemeOptions` | Configuration accepted by `buildKeycloakTheme`. |

## Troubleshooting

### Vite cannot parse `.vue` files

Ensure `@vitejs/plugin-vue` is installed and included in the Vite config under
the same `cwd` passed to the builder.

### The page is blank in Keycloak

- Confirm JavaScript is enabled and the generated module script is not blocked.
- Check the browser console and the requests under the theme's `resources/` URL.
- Keep the `#app`, `clientScriptPath`, `headTags`, and `cssLinks` markers in a
  custom HTML template.
- Keep the `app` export in a custom entry template.
- If a custom Content Security Policy defines `script-src`, allow the generated
  module scripts and the inline environment script.

### Keycloak ignores a generated page

Check that the Vue filename exactly matches the FreeMarker template name used by
your Keycloak release and authentication flow. The built-in name validation is
only a warning and cannot determine which pages a particular flow will use.

### Values work in debug mode but not in Keycloak

`debug` values never enter a production FTL page. Verify the FreeMarker
expression in `field`, inspect Keycloak server logs for template errors, and add
an appropriate `default` where the value is optional.

### Build output unexpectedly disappeared

`outDir` and `tempDir` are clean-build directories and are recursively removed.
Use dedicated paths for both options.

## License

[MIT](./LICENSE)
