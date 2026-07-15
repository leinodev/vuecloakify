import fs from "node:fs";
import path from "node:path";

export interface ManifestEntry {
  file?: string;
  name?: string;
  src?: string;
  isEntry?: boolean;
  css?: string[];
  imports?: string[];
}

export type ClientManifest = Record<string, ManifestEntry>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseManifest(contents: string, manifestPath: string): ClientManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`[vuecloakify] Invalid Vite client manifest JSON: ${manifestPath}`, { cause: error });
  }

  if (!isRecord(parsed)) {
    throw new Error(`[vuecloakify] Invalid Vite client manifest: ${manifestPath}`);
  }

  for (const value of Object.values(parsed)) {
    if (
      !isRecord(value)
      || (value.file !== undefined && typeof value.file !== "string")
      || (value.name !== undefined && typeof value.name !== "string")
      || (value.src !== undefined && typeof value.src !== "string")
      || (value.isEntry !== undefined && typeof value.isEntry !== "boolean")
      || (value.css !== undefined && !isStringArray(value.css))
      || (value.imports !== undefined && !isStringArray(value.imports))
    ) {
      throw new Error(`[vuecloakify] Invalid Vite client manifest: ${manifestPath}`);
    }
  }

  return parsed as ClientManifest;
}

export function findManifestEntry(manifest: ClientManifest, routePath: string): ManifestEntry | undefined {
  const entries = Object.entries(manifest);
  const namedEntries = entries.filter(([, entry]) => entry.isEntry === true && entry.name === routePath);
  if (namedEntries.length > 0) return namedEntries.length === 1 ? namedEntries[0]?.[1] : undefined;

  // Vite 5.0 omits `name` from entry chunks. Its manifest key or `src` still
  // identifies the generated input, whose basename is controlled by us.
  const expectedSourceName = `${routePath}-entry.ts`;
  const sourceEntries = entries.filter(([key, entry]) => entry.isEntry === true && (
    path.posix.basename(key.replaceAll("\\", "/")) === expectedSourceName
    || (entry.src !== undefined && path.posix.basename(entry.src.replaceAll("\\", "/")) === expectedSourceName)
  ));
  return sourceEntries.length === 1 ? sourceEntries[0]?.[1] : undefined;
}

/** Reads and validates every page entry before prerendering can write pages. */
export function readClientManifest(manifestPath: string, routePaths: string[]): ClientManifest {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`[vuecloakify] Vite client manifest was not generated: ${manifestPath}`);
  }

  const manifest = parseManifest(fs.readFileSync(manifestPath, "utf8"), manifestPath);
  for (const routePath of routePaths) {
    const entry = findManifestEntry(manifest, routePath);
    if (!entry) {
      throw new Error(`[vuecloakify] Vite client manifest has no entry for route "${routePath}".`);
    }
    if (!entry.file) {
      throw new Error(`[vuecloakify] Vite client manifest entry for route "${routePath}" has no output file.`);
    }
  }

  return manifest;
}
