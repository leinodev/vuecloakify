import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.resolve(packageRoot, "src");

function collectTests(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((first, second) => first.name.localeCompare(second.name))
    .flatMap((entry) => {
      const entryPath = path.resolve(directory, entry.name);
      if (entry.isDirectory()) return collectTests(entryPath);
      return entry.isFile() && entry.name.endsWith(".test.ts") ? [entryPath] : [];
    });
}

const testFiles = collectTests(sourceDir);
if (testFiles.length === 0) throw new Error("[vuecloakify] No test files (*.test.ts) found.");

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
  cwd: packageRoot,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
