import { chmodSync, cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.resolve(packageRoot, "dist");
const require = createRequire(import.meta.url);
const tscPath = require.resolve("typescript/bin/tsc");

rmSync(distDir, { recursive: true, force: true });

const result = spawnSync(process.execPath, [tscPath, "-p", "tsconfig.build.json"], {
  cwd: packageRoot,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const templatesDir = path.resolve(distDir, "templates");
mkdirSync(templatesDir, { recursive: true });
cpSync(path.resolve(packageRoot, "src/templates/template.html"), path.resolve(templatesDir, "template.html"));
cpSync(path.resolve(packageRoot, "src/templates/entry.ts"), path.resolve(templatesDir, "entry.ts"));
chmodSync(path.resolve(distDir, "build/bin.js"), 0o755);
