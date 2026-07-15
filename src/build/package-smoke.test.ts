import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const compiledCli = path.resolve(packageRoot, "dist/build/bin.js");

function writeFixtureFile(root: string, relativePath: string, contents: string): void {
  const file = path.resolve(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function runCli(cwd: string, ...args: string[]): string {
  const result = spawnSync(process.execPath, [compiledCli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    timeout: 60_000,
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return `${result.stdout}\n${result.stderr}`;
}

test("compiled CLI loads TypeScript config and builds production and debug themes", { timeout: 120_000 }, (context) => {
  const fixture = fs.mkdtempSync(path.resolve(packageRoot, ".package-smoke-"));
  const externalTemp = fs.mkdtempSync(path.resolve(os.tmpdir(), "vuecloakify-smoke-"));
  const packageScope = path.resolve(packageRoot, "node_modules/@leinodev");
  const selfLink = path.resolve(packageScope, "vuecloakify");
  const createdSelfLink = !fs.existsSync(selfLink);
  if (createdSelfLink) {
    fs.mkdirSync(packageScope, { recursive: true });
    fs.symlinkSync(packageRoot, selfLink, process.platform === "win32" ? "junction" : "dir");
  }
  context.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  context.after(() => fs.rmSync(externalTemp, { recursive: true, force: true }));
  context.after(() => {
    if (createdSelfLink) fs.rmSync(selfLink, { recursive: true, force: true });
  });

  writeFixtureFile(
    fixture,
    "package.json",
    JSON.stringify({
      name: "vuecloakify-package-smoke",
      private: true,
      type: "module",
      dependencies: { pinia: "^3.0.0" },
    }),
  );
  writeFixtureFile(
    fixture,
    "vuecloakify.config.ts",
    `import { defineConfig } from "@leinodev/vuecloakify/build";

export default defineConfig({
  themeSource: "src/theme",
  loginDir: "login-$&",
  emailDir: null,
  outDir: "dist",
  tempDir: ${JSON.stringify(externalTemp)},
  entryTemplate: "src/theme-entry.ts"
});
`,
  );
  writeFixtureFile(
    fixture,
    "vite.config.ts",
    `import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  root: "consumer-root",
  base: "/consumer-base/",
  publicDir: new URL("./consumer-public", import.meta.url).pathname,
  cacheDir: new URL("./consumer-cache", import.meta.url).pathname,
  plugins: [vue()],
  resolve: {
    alias: {
      "@fixture": new URL("./src", import.meta.url).pathname
    }
  },
  define: {
    __CONSUMER_DEFINE__: JSON.stringify("consumer config loaded"),
    "import.meta.env.DEV": "false",
    "import.meta.env.PROD": "false"
  },
  experimental: {
    renderBuiltUrl() {
      return "/consumer-url";
    }
  },
  ssr: {
    target: "webworker",
    external: ["@leinodev/vuecloakify", "pinia"],
    noExternal: ["consumer-setting-must-not-control-the-build"]
  },
  build: {
    outDir: new URL("./consumer-build-output", import.meta.url).pathname,
    lib: {
      entry: "src/consumer-lib.ts",
      formats: ["es"]
    },
    write: false,
    watch: {},
    ssr: "src/consumer-ssr-entry.ts",
    rollupOptions: {
      input: "src/consumer-rollup-entry.ts",
      external: ["@fixture/schema", "vue"],
      output: [
        { dir: new URL("./consumer-rollup-output-one", import.meta.url).pathname, entryFileNames: "[name].js" },
        { dir: new URL("./consumer-rollup-output-two", import.meta.url).pathname, entryFileNames: "[name].js" }
      ]
    }
  }
});
`,
  );
  writeFixtureFile(
    fixture,
    "src/theme-entry.ts",
    `import { createApp, h } from "vue";
import { createPinia } from "pinia";
import { entryPlugin } from "@fixture/entry-plugin";
import PageComponent from "PAGE_COMPONENT_IMPORT";

const app = createApp({ render: () => h(PageComponent) });
app.use(createPinia());
app.use(entryPlugin);

if (typeof window !== "undefined") app.mount("#app");

export { app };
`,
  );
  writeFixtureFile(
    fixture,
    "src/entry-plugin.ts",
    `export const entryPlugin = {
  install() {
    console.debug("consumer custom entry loaded");
  }
};
`,
  );
  writeFixtureFile(fixture, "src/consumer-lib.ts", "export const ignored = true;\n");
  writeFixtureFile(fixture, "src/consumer-ssr-entry.ts", "export const ignored = true;\n");
  writeFixtureFile(fixture, "src/consumer-rollup-entry.ts", "export const ignored = true;\n");
  writeFixtureFile(
    fixture,
    "src/schema.ts",
    `import { ftlString } from "@leinodev/vuecloakify";
export const greetingField = ftlString({ field: "realm.displayName", debug: "Preview" });
`,
  );
  writeFixtureFile(
    fixture,
    "src/theme/login-$&/login.vue",
    `<script setup lang="ts">
import { useEnvironment } from "@leinodev/vuecloakify";
import { greetingField } from "@fixture/schema";
const environment = useEnvironment({ greeting: greetingField });
const consumerDefine = __CONSUMER_DEFINE__;
const viteMode = import.meta.env.DEV && !import.meta.env.PROD
  ? "vite debug"
  : !import.meta.env.DEV && import.meta.env.PROD
    ? "vite production"
    : "vite inconsistent";
</script>

<template><h1>{{ environment.greeting }} {{ consumerDefine }} {{ viteMode }}</h1></template>
`,
  );
  writeFixtureFile(
    fixture,
    "src/theme/login-$&/__proto__.vue",
    `<script setup lang="ts">
import { ftlString, useEnvironment } from "@leinodev/vuecloakify";
const environment = useEnvironment({ greeting: ftlString({ field: "realm.displayName", debug: "Prototype" }) });
</script>

<template><h1>{{ environment.greeting }}</h1></template>
`,
  );
  writeFixtureFile(
    fixture,
    "src/theme/login-$&/register.vue",
    `<script setup lang="ts">
import logoUrl from "../../assets/logo.svg";
import { ftlString, useEnvironment } from "@leinodev/vuecloakify";
const environment = useEnvironment({ greeting: ftlString({ field: "realm.displayName", debug: "Register" }) });
const loadLazyMessage = () => import("../../lazy.js").then(module => module.message);
</script>

<template><img :src="logoUrl" alt="" /><h1>{{ environment.greeting }}</h1><button @click="loadLazyMessage">Load</button></template>
`,
  );
  writeFixtureFile(fixture, "src/lazy.ts", "export const message = \"loaded\";\n");
  writeFixtureFile(
    fixture,
    "src/assets/logo.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><desc>${"x".repeat(5_000)}</desc><path d="M0 0h10v10H0z" /></svg>`,
  );
  writeFixtureFile(fixture, "public/login/theme.properties", "parent=keycloak\n");
  writeFixtureFile(fixture, "consumer-public/leaked.txt", "must not be copied\n");

  runCli(fixture);

  const productionPage = fs.readFileSync(path.resolve(fixture, "dist/login/login.ftl"), "utf8");
  assert.match(productionPage, /<#noautoesc>window\.ENVIRONMENT/);
  assert.ok(fs.existsSync(path.resolve(fixture, "dist/login/__proto__.ftl")));
  assert.ok(fs.existsSync(path.resolve(fixture, "dist/login/theme.properties")));
  assert.equal(fs.existsSync(path.resolve(fixture, "dist/login/leaked.txt")), false);
  assert.equal(fs.existsSync(path.resolve(fixture, "dist/login/.vite")), false);
  assert.equal(fs.existsSync(path.resolve(fixture, "consumer-build-output")), false);
  assert.equal(fs.existsSync(path.resolve(fixture, "consumer-rollup-output-one")), false);
  assert.equal(fs.existsSync(path.resolve(fixture, "consumer-rollup-output-two")), false);
  assert.equal(fs.existsSync(path.resolve(fixture, "consumer-cache")), false);
  assert.equal(fs.existsSync(externalTemp), false);
  const productionResourceFiles = fs.readdirSync(path.resolve(fixture, "dist/login/resources"));
  const productionJavaScript = productionResourceFiles
    .filter((file) => file.endsWith(".js"))
    .map((file) => fs.readFileSync(path.resolve(fixture, "dist/login/resources", file), "utf8"))
    .join("\n");
  assert.match(productionJavaScript, /vite production/);
  assert.doesNotMatch(productionJavaScript, /vite debug|vite inconsistent/);

  runCli(fixture, "--debug", "--out", "debug-dist");

  const debugPage = fs.readFileSync(path.resolve(fixture, "debug-dist/login/login.html"), "utf8");
  assert.doesNotMatch(debugPage, /<#noautoesc>|\$\{realm\.displayName/);
  const debugRegisterPage = fs.readFileSync(path.resolve(fixture, "debug-dist/login/register.html"), "utf8");
  assert.match(debugRegisterPage, /src="\/login\/resources\/register-entry-/);
  const debugResourceFiles = fs.readdirSync(path.resolve(fixture, "debug-dist/login/resources"));
  const debugJavaScript = debugResourceFiles
    .filter((file) => file.endsWith(".js"))
    .map((file) => fs.readFileSync(path.resolve(fixture, "debug-dist/login/resources", file), "utf8"))
    .join("\n");
  assert.match(debugJavaScript, /\/login\/resources\/logo-/);
  assert.ok(debugResourceFiles.some((file) => /^lazy-.*\.js$/.test(file)));
  assert.match(debugJavaScript, /consumer config loaded/);
  assert.match(debugJavaScript, /consumer custom entry loaded/);
  assert.match(debugJavaScript, /vite debug/);
  assert.doesNotMatch(debugJavaScript, /vite production|vite inconsistent|consumer-url|consumer-base/);
  assert.ok(fs.existsSync(path.resolve(fixture, "debug-dist/login/__proto__.html")));
  assert.equal(fs.existsSync(path.resolve(fixture, "debug-dist/login/leaked.txt")), false);
  assert.equal(fs.existsSync(path.resolve(fixture, "debug-dist/login/consumer")), false);
  assert.equal(fs.existsSync(path.resolve(fixture, "consumer-build-output")), false);
  assert.equal(fs.existsSync(path.resolve(fixture, "consumer-rollup-output-one")), false);
  assert.equal(fs.existsSync(path.resolve(fixture, "consumer-rollup-output-two")), false);
  assert.equal(fs.existsSync(path.resolve(fixture, "consumer-cache")), false);
  assert.equal(fs.existsSync(path.resolve(fixture, "debug-dist/login/.vite")), false);
  assert.equal(fs.existsSync(externalTemp), false);
});
