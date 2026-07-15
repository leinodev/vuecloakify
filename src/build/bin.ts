#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile } from "vite";
import { buildKeycloakTheme, type BuildKeycloakThemeOptions } from "./index.js";

const CONFIG_FILES = [
  "vuecloakify.config.ts",
  "vuecloakify.config.mts",
  "vuecloakify.config.mjs",
  "vuecloakify.config.js",
  "vuecloakify.config.cts",
  "vuecloakify.config.cjs",
];

const BUILD_OPTION_KEYS = new Set<keyof BuildKeycloakThemeOptions>([
  "cwd",
  "themeSource",
  "loginDir",
  "emailDir",
  "publicDir",
  "outDir",
  "tempDir",
  "htmlTemplate",
  "entryTemplate",
  "debug",
  "validatePageNames",
]);

interface ParsedArgs {
  configFile?: string;
  options: Partial<BuildKeycloakThemeOptions>;
  showHelp: boolean;
  showVersion: boolean;
}

function takeValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) throw new Error(`[vuecloakify] ${flag} requires a value.`);
  return value;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { options: {}, showHelp: false, showVersion: false };

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];

    if (argument === "--debug") parsed.options.debug = true;
    else if (argument === "--no-validate") parsed.options.validatePageNames = false;
    else if (argument === "--help" || argument === "-h") parsed.showHelp = true;
    else if (argument === "--version" || argument === "-v") parsed.showVersion = true;
    else if (argument === "--out") parsed.options.outDir = takeValue(argv, index++, argument);
    else if (argument === "--source") parsed.options.themeSource = takeValue(argv, index++, argument);
    else if (argument === "--config") parsed.configFile = takeValue(argv, index++, argument);
    else if (argument.startsWith("--out=")) parsed.options.outDir = argument.slice("--out=".length);
    else if (argument.startsWith("--source=")) parsed.options.themeSource = argument.slice("--source=".length);
    else if (argument.startsWith("--config=")) parsed.configFile = argument.slice("--config=".length);
    else throw new Error(`[vuecloakify] Unknown option: ${argument}`);
  }

  return parsed;
}

function validateConfig(config: BuildKeycloakThemeOptions, file: string): void {
  const unknownKeys = Object.keys(config).filter((key) => !BUILD_OPTION_KEYS.has(key as keyof BuildKeycloakThemeOptions));
  if (unknownKeys.length > 0) {
    throw new Error(`[vuecloakify] Unknown option${unknownKeys.length === 1 ? "" : "s"} in ${file}: ${unknownKeys.join(", ")}`);
  }
}

async function loadConfigFile(cwd: string, explicitFile?: string): Promise<BuildKeycloakThemeOptions> {
  const file = explicitFile
    ? path.resolve(cwd, explicitFile)
    : CONFIG_FILES.map((name) => path.resolve(cwd, name)).find((candidate) => fs.existsSync(candidate));

  if (!file) return {};
  if (!fs.existsSync(file)) throw new Error(`[vuecloakify] Config file not found: ${file}`);

  const loaded = await loadConfigFromFile({ command: "build", mode: "production" }, file, cwd);
  const config = (loaded?.config ?? {}) as unknown as BuildKeycloakThemeOptions;
  validateConfig(config, file);
  return config;
}

function packageVersion(): string {
  const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../package.json");
  const manifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { version: string };
  return manifest.version;
}

function printHelp(): void {
  console.log(`Usage: vuecloakify [options]

Build a Vue project into a conventional Keycloak theme directory.

Options:
  --config <file>   Use a specific config file
  --source <dir>    Override themeSource
  --out <dir>       Override outDir
  --debug           Emit preview HTML and use debug schema values
  --no-validate     Do not warn about unknown Keycloak template names
  -h, --help        Show this help
  -v, --version     Show the package version

Default config: vuecloakify.config.{ts,mts,mjs,js,cts,cjs}`);
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.showHelp) {
    printHelp();
    return;
  }
  if (parsed.showVersion) {
    console.log(packageVersion());
    return;
  }

  const fileOptions = await loadConfigFile(cwd, parsed.configFile);
  await buildKeycloakTheme({ ...fileOptions, ...parsed.options });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
