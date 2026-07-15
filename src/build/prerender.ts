import * as fs from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build, loadConfigFromFile, mergeConfig, type InlineConfig, type UserConfig } from "vite";
import { renderToString } from "vue/server-renderer";
import { cleanDirectory } from "./fs.js";
import {
  findManifestEntry as findClientManifestEntry,
  readClientManifest,
  type ClientManifest,
  type ManifestEntry,
} from "./manifest.js";
import { fixResourcesPath } from "../runtime/resources.js";
import {
  VUECLOAKIFY_BUILD_CONTEXT,
  type VuecloakifyBuildContextChannel,
  type VuecloakifyBuildState,
} from "../runtime/build-context.js";

export interface PrerenderParams {
  /** Directory containing theme pages (`*.vue`). */
  source: string;
  /** Output directory for generated FTL/HTML and assets. */
  dist: string;
  /** Temporary directory for generated entry files and the SSR bundle. */
  temp: string;
}

export interface PrerenderContext {
  cwd: string;
  htmlTemplate: string;
  entryTemplate: string;
  debug: boolean;
}

interface InternalContext extends PrerenderContext {
  tempEntries: string;
  tempSsr: string;
  dist: string;
  source: string;
  manifest: ClientManifest;
}

interface BuildContextChannel extends VuecloakifyBuildContextChannel {
  run<T>(state: VuecloakifyBuildState, callback: () => T): T;
}

const fallbackBuildContext: BuildContextChannel = new AsyncLocalStorage<VuecloakifyBuildState>();
const generatedEntryDependencies = ["vue"];

interface ProjectManifest {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
}

/** Finds the closest project manifest so generated entries resolve the project's own direct dependencies. */
function findProjectDependencies(cwd: string): string[] {
  let directory = cwd;
  while (true) {
    const manifestPath = path.resolve(directory, "package.json");
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ProjectManifest;
      const declared = [
        manifest.dependencies,
        manifest.devDependencies,
        manifest.optionalDependencies,
        manifest.peerDependencies,
      ].flatMap((dependencies) => Object.keys(dependencies ?? {}));
      return [...new Set([...generatedEntryDependencies, ...declared])];
    }

    const parent = path.dirname(directory);
    if (parent === directory) return generatedEntryDependencies;
    directory = parent;
  }
}

function isBuildContextChannel(value: unknown): value is BuildContextChannel {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BuildContextChannel>;
  return typeof candidate.getStore === "function" && typeof candidate.run === "function";
}

function runWithBuildContext<T>(state: VuecloakifyBuildState, callback: () => T): T {
  const buildGlobal = globalThis as typeof globalThis & Record<symbol, unknown>;
  const currentChannel = buildGlobal[VUECLOAKIFY_BUILD_CONTEXT];
  const channel = isBuildContextChannel(currentChannel) ? currentChannel : fallbackBuildContext;
  if (currentChannel !== channel) buildGlobal[VUECLOAKIFY_BUILD_CONTEXT] = channel;
  return channel.run(state, callback);
}

/**
 * Prerenders every `*.vue` page from `source` into a FreeMarker template:
 * 1. generates an entry file from `entryTemplate`;
 * 2. builds client (JS and CSS) and SSR bundles with Vite;
 * 3. renders each page once so `useEnvironment` can collect its FTL script;
 * 4. injects the output into `htmlTemplate` and writes `<page>.ftl`, or `.html`
 *    in debug mode.
 *
 * Vue plugins, aliases, and auto-imports come from the consumer's
 * `vite.config.*`, which Vite discovers automatically under `root = cwd`.
 */
export async function prerender(params: PrerenderParams, baseContext: PrerenderContext): Promise<void> {
  const files = fs.readdirSync(params.source).filter((file) => file.endsWith(".vue")).sort();
  if (files.length === 0) {
    console.warn(`[vuecloakify] No login pages (*.vue) found in ${params.source}`);
    return;
  }

  const ctx: InternalContext = {
    ...baseContext,
    tempEntries: path.resolve(params.temp, "entries"),
    tempSsr: path.resolve(params.temp, "ssr"),
    dist: params.dist,
    source: params.source,
    manifest: {},
  };

  cleanDirectory(ctx.dist, true);
  cleanDirectory(params.temp, true);
  cleanDirectory(ctx.tempEntries, true);
  cleanDirectory(ctx.tempSsr, true);

  files.forEach((file) => generateEntryForPage(file, ctx));

  await buildClientBundle(files, ctx);
  loadManifest(
    ctx,
    files.map((file) => path.basename(file, ".vue")),
  );

  const compiledModules = await buildSSRBundle(files, ctx);
  for (const [routePath, componentModule] of compiledModules) {
    await prerenderPage(componentModule, routePath, ctx);
  }

  console.log(`[vuecloakify] Built ${files.length} login page(s) at ${ctx.dist}`);
}

function pageEntryInputs(files: string[], ctx: InternalContext): Record<string, string> {
  return Object.fromEntries(files.map((file) => {
    const name = path.basename(file, ".vue");
    return [name, path.resolve(ctx.tempEntries, `${name}-entry.ts`)];
  }));
}

function generateEntryForPage(pageFileName: string, ctx: InternalContext): void {
  const pageName = path.basename(pageFileName, ".vue");
  const entryFilePath = path.resolve(ctx.tempEntries, `${pageName}-entry.ts`);
  const pageComponentPath = path
    .relative(ctx.tempEntries, path.resolve(ctx.source, pageFileName))
    .replace(/\\/g, "/");

  const entry = ctx.entryTemplate.replaceAll("PAGE_COMPONENT_IMPORT", () => pageComponentPath);
  fs.writeFileSync(entryFilePath, entry);
}

function buildEnvironmentDefines(debug: boolean): Record<string, boolean> {
  return {
    "import.meta.env.DEV": debug,
    "import.meta.env.PROD": !debug,
  };
}

/**
 * Loads transformations from the theme project's Vite config without allowing
 * that config to take over build orchestration or output paths.
 */
async function isolatedViteConfig(
  ctx: InternalContext,
  isSsrBuild: boolean,
  controlledConfig: InlineConfig,
): Promise<InlineConfig> {
  const loaded = await loadConfigFromFile(
    { command: "build", mode: "production", isSsrBuild },
    undefined,
    ctx.cwd,
  );
  const consumerConfig: UserConfig = { ...(loaded?.config ?? {}) };

  // The theme builder owns every build and output option. In particular,
  // Vite concatenates array-valued Rollup outputs during config merging, so
  // attempting to override these fields with another object is not sufficient.
  delete consumerConfig.build;
  delete consumerConfig.builder;
  delete consumerConfig.environments;
  delete consumerConfig.root;
  delete consumerConfig.base;
  delete consumerConfig.publicDir;
  delete consumerConfig.cacheDir;

  // SSR output is imported directly from the temporary directory. Leaving a
  // consumer dependency external would make Node resolve it relative to that
  // directory, which can be outside the theme project and its node_modules.
  // Keep useful SSR conditions, but let the builder own externalization.
  if (consumerConfig.ssr) {
    consumerConfig.ssr = { ...consumerConfig.ssr };
    delete consumerConfig.ssr.external;
    delete consumerConfig.ssr.noExternal;
  }

  // Worker transforms and plugins remain useful, but their Rollup output can
  // otherwise point outside the builder-controlled output directory.
  if (consumerConfig.worker?.rollupOptions) {
    consumerConfig.worker = { ...consumerConfig.worker };
    delete consumerConfig.worker.rollupOptions;
  }

  return mergeConfig(consumerConfig, {
    ...controlledConfig,
    configFile: false,
    root: ctx.cwd,
    base: "/",
    publicDir: false,
    cacheDir: path.resolve(ctx.tempSsr, "../vite-cache"),
    mode: "production",
    // Generated entries can live outside `root`; dedupe deliberately resolves
    // their bare imports from the consumer project while retaining aliases.
    resolve: { dedupe: findProjectDependencies(ctx.cwd) },
  }) as InlineConfig;
}

async function buildClientBundle(files: string[], ctx: InternalContext): Promise<void> {
  const config = await isolatedViteConfig(ctx, false, {
    define: buildEnvironmentDefines(ctx.debug),
    // Assets referenced by JavaScript, such as dynamic imports and images, are
    // resolved at runtime through the path provided by Keycloak.
    experimental: {
      renderBuiltUrl(filename, { hostType }) {
        const rel = filename.replace(/^resources\//, "");
        if (hostType === "js") {
          if (ctx.debug) return { runtime: JSON.stringify(`/login/resources/${rel}`) };
          return { runtime: `(window.ENVIRONMENT?.resourcesPath ?? "") + ${JSON.stringify("/" + rel)}` };
        }
        return { relative: true };
      },
    },
    build: {
      outDir: ctx.dist,
      manifest: true,
      assetsDir: "resources",
      copyPublicDir: false,
      cssCodeSplit: true,
      minify: !ctx.debug,
      emptyOutDir: false,
      rollupOptions: {
        input: pageEntryInputs(files, ctx),
        output: {
          format: "es",
          entryFileNames: "resources/[name]-entry-[hash].js",
          chunkFileNames: "resources/[name]-[hash].js",
          assetFileNames: "resources/[name]-[hash][extname]",
        },
      },
    },
  });
  await build(config);
}

async function buildSSRBundle(files: string[], ctx: InternalContext): Promise<Map<string, CompiledModule>> {
  const input = pageEntryInputs(files, ctx);
  const config = await isolatedViteConfig(ctx, true, {
    define: buildEnvironmentDefines(ctx.debug),
    // The compiled module is imported from temp after Vite exits. Bundling its
    // dependencies avoids bare imports whose Node resolution would start there.
    ssr: { noExternal: true, target: "node" },
    build: {
      ssr: true,
      outDir: ctx.tempSsr,
      copyPublicDir: false,
      emptyOutDir: false,
      minify: false,
      rollupOptions: {
        input,
        output: {
          format: "es",
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
  });
  await build(config);

  const compiled = new Map<string, CompiledModule>();
  for (const name of Object.keys(input)) {
    const outputFilePath = path.resolve(ctx.tempSsr, `${name}.js`);
    const moduleUrl = pathToFileURL(outputFilePath).href;
    const { app } = (await import(moduleUrl)) as CompiledModule;
    compiled.set(name, { app });
  }
  return compiled;
}

interface CompiledModule {
  app: Parameters<typeof renderToString>[0];
}

async function prerenderPage(mod: CompiledModule, routePath: string, ctx: InternalContext): Promise<void> {
  const buildState: VuecloakifyBuildState = { debug: ctx.debug, environmentScripts: [] };
  await runWithBuildContext(buildState, async () => {
    await renderToString(mod.app);
  });

  const payload: Record<string, string> = {
    htmlAttrs: "",
    headTags: buildState.environmentScripts
      .map((script) => `<script type="text/javascript">${script}</script>`)
      .join("\n"),
    bodyAttrs: "",
    bodyTagsOpen: "",
    bodyTags: "",
    // The theme renders on the client with createApp and no hydration.
    appHtml: "",
    clientScriptPath: findClientScript(routePath, ctx) ?? "",
    cssLinks: findCSSAssets(routePath, ctx),
  };

  let html = ctx.htmlTemplate;
  for (const [key, value] of Object.entries(payload)) {
    html = html.replaceAll(`<!--${key}-->`, () => value);
  }

  const ext = ctx.debug ? "html" : "ftl";
  fs.writeFileSync(path.resolve(ctx.dist, `${routePath}.${ext}`), html);
  console.log(`[vuecloakify] Login page: ${routePath}.${ext}`);
}

function loadManifest(ctx: InternalContext, routePaths: string[]): void {
  const manifestDir = path.resolve(ctx.dist, ".vite");
  const manifestPath = path.resolve(manifestDir, "manifest.json");
  try {
    ctx.manifest = readClientManifest(manifestPath, routePaths);
  } finally {
    fs.rmSync(manifestDir, { recursive: true, force: true });
  }
}

function findManifestEntry(ctx: InternalContext, routePath: string): ManifestEntry | undefined {
  return findClientManifestEntry(ctx.manifest, routePath);
}

function findClientScript(routePath: string, ctx: InternalContext): string | null {
  const entry = findManifestEntry(ctx, routePath);
  return entry?.file ? fixResourcesPath(ctx.debug, entry.file, "login") : null;
}

function findCSSAssets(routePath: string, ctx: InternalContext): string {
  const entry = findManifestEntry(ctx, routePath);
  if (!entry) {
    console.warn(`[vuecloakify] No Vite manifest entry found for ${routePath}`);
    return "";
  }

  const cssFiles = new Set<string>();
  const collectCSS = (e: ManifestEntry | undefined) => {
    if (!e) return;
    e.css?.forEach((css) => cssFiles.add(css));
    e.imports?.forEach((key) => collectCSS(ctx.manifest[key]));
  };
  collectCSS(entry);

  return Array.from(cssFiles)
    .map((css) => `<link rel="stylesheet" href="${fixResourcesPath(ctx.debug, css, "login")}" />`)
    .join("\n");
}
