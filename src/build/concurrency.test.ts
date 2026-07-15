import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildKeycloakTheme } from "./index.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const barrierSymbol = Symbol.for("vuecloakify.concurrent-build-test");

function writeFile(root: string, relativePath: string, contents: string): void {
  const file = path.resolve(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function createThemeProject(label: string): string {
  const cwd = fs.mkdtempSync(path.resolve(packageRoot, `.concurrent-${label}-`));
  writeFile(
    cwd,
    "vite.config.ts",
    `import { writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    vue(),
    {
      name: "external-runtime-channel-regression",
      configResolved(config) {
        if (config.build.ssr) {
          // Bypass the builder's normal self-contained SSR policy so this test
          // exercises the AsyncLocalStorage channel across an external runtime.
          config.ssr.external = ["@leinodev/vuecloakify"];
          const environmentResolve = config.environments?.ssr?.resolve;
          if (environmentResolve) environmentResolve.external = ["@leinodev/vuecloakify"];
        }
      },
      generateBundle(_options, bundle) {
        const externalized = Object.values(bundle).some(
          output => output.type === "chunk" && output.imports.includes("@leinodev/vuecloakify")
        );
        if (externalized) writeFileSync(new URL(".runtime-externalized", import.meta.url), "yes");
      }
    }
  ],
});
`,
  );
  writeFile(
    cwd,
    "src/theme/login/login.vue",
    `<script setup lang="ts">
import { ftlString, useEnvironment } from "@leinodev/vuecloakify";
const barrier = (globalThis as any)[Symbol.for("vuecloakify.concurrent-build-test")];
await barrier.wait();
const environment = useEnvironment({
  greeting: ftlString({ field: "realm.displayName", debug: "Preview" }),
});
</script>

<template><h1>{{ environment.greeting }}</h1></template>
`,
  );
  return cwd;
}

function twoPartyBarrier(): { wait(): Promise<void> } {
  let arrivals = 0;
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const timeout = setTimeout(() => rejectReady(new Error("Concurrent builds did not reach the SSR barrier.")), 60_000);

  return {
    async wait() {
      arrivals += 1;
      if (arrivals === 2) {
        clearTimeout(timeout);
        resolveReady();
      }
      await ready;
    },
  };
}

test("isolates debug state across concurrent programmatic builds", { timeout: 120_000 }, async (context) => {
  const debugProject = createThemeProject("debug");
  const productionProject = createThemeProject("production");
  const debugGlobal = globalThis as typeof globalThis & Record<symbol, unknown>;
  const hadBarrier = Object.prototype.hasOwnProperty.call(debugGlobal, barrierSymbol);
  const previousBarrier = debugGlobal[barrierSymbol];

  context.after(() => {
    fs.rmSync(debugProject, { recursive: true, force: true });
    fs.rmSync(productionProject, { recursive: true, force: true });
    if (hadBarrier) debugGlobal[barrierSymbol] = previousBarrier;
    else delete debugGlobal[barrierSymbol];
  });

  debugGlobal[barrierSymbol] = twoPartyBarrier();
  await Promise.all([
    buildKeycloakTheme({
      cwd: debugProject,
      debug: true,
      emailDir: null,
      publicDir: null,
      outDir: "dist",
      tempDir: ".temp",
    }),
    buildKeycloakTheme({
      cwd: productionProject,
      debug: false,
      emailDir: null,
      publicDir: null,
      outDir: "dist",
      tempDir: ".temp",
    }),
  ]);

  const debugPage = fs.readFileSync(path.resolve(debugProject, "dist/login/login.html"), "utf8");
  const productionPage = fs.readFileSync(path.resolve(productionProject, "dist/login/login.ftl"), "utf8");
  assert.equal(fs.readFileSync(path.resolve(debugProject, ".runtime-externalized"), "utf8"), "yes");
  assert.equal(fs.readFileSync(path.resolve(productionProject, ".runtime-externalized"), "utf8"), "yes");
  assert.doesNotMatch(debugPage, /<#noautoesc>|\$\{realm\.displayName/);
  assert.match(productionPage, /<#noautoesc>window\.ENVIRONMENT/);
});
