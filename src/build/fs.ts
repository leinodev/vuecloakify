import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";

/** Removes a directory and, when `create` is true, recreates it empty. */
export function cleanDirectory(dir: string, create = false): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  if (create) mkdirSync(dir, { recursive: true });
}

/** Recursively copies the contents of `source` into `destination`. */
export function copyDir(source: string, destination: string): void {
  if (!existsSync(source)) return;
  cpSync(source, destination, { recursive: true, force: true });
}
