import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanDirectory, copyDir } from "./fs.js";
import { prerender } from "./prerender.js";
import { buildEmail } from "./email.js";
import { warnUnknownTemplates } from "./validate.js";

export interface BuildKeycloakThemeOptions {
  /** Theme project root. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Theme source directory containing `loginDir` and `emailDir`. Defaults to `src/theme`. */
  themeSource?: string;
  /** Login-page directory (`*.vue`) relative to `themeSource`. Use `null` to skip it. Defaults to `login`. */
  loginDir?: string | null;
  /** Email-template directory (`*.mjml`) relative to `themeSource`. Use `null` to skip it. Defaults to `email`. */
  emailDir?: string | null;
  /** Static files such as `theme.properties`, messages, and images. Copied into `outDir`. Defaults to `public`; use `null` to skip. */
  publicDir?: string | null;
  /** Theme output directory. Defaults to `dist`. */
  outDir?: string;
  /** Temporary build directory. Defaults to `.vuecloakify`. */
  tempDir?: string;
  /** Path to an HTML page template, or the template contents. Defaults to the bundled `templates/template.html`. */
  htmlTemplate?: string;
  /** Path to an entry template (`main.ts`), or the template contents. Defaults to the bundled `templates/entry.ts`. */
  entryTemplate?: string;
  /** Emit preview `.html` instead of `.ftl` and use environment `debug` values. */
  debug?: boolean;
  /** Warn about page names outside Keycloak's standard template set. Defaults to `true`. */
  validatePageNames?: boolean;
}

const bundledTemplatesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../templates");

function isSameOrChild(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function pathsOverlap(first: string, second: string): boolean {
  return isSameOrChild(first, second) || isSameOrChild(second, first);
}

/** Resolves symlinks in the closest existing ancestor without requiring the final path to exist. */
function canonicalPath(directory: string): string {
  let existingAncestor = directory;
  const missingSegments: string[] = [];

  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) return path.resolve(directory);
    missingSegments.unshift(path.basename(existingAncestor));
    existingAncestor = parent;
  }

  return path.resolve(fs.realpathSync.native(existingAncestor), ...missingSegments);
}

function assertSafeBuildDirectories(options: {
  cwd: string;
  sources: Array<{ label: string; directory: string }>;
  outDir: string;
  tempDir: string;
}): void {
  const canonicalCwd = canonicalPath(options.cwd);
  const canonicalSources = options.sources.map((source) => ({
    ...source,
    directory: canonicalPath(source.directory),
  }));
  const canonicalOutDir = canonicalPath(options.outDir);
  const canonicalTempDir = canonicalPath(options.tempDir);

  for (const [label, directory] of [
    ["outDir", canonicalOutDir],
    ["tempDir", canonicalTempDir],
  ] as const) {
    if (directory === path.parse(directory).root || isSameOrChild(directory, canonicalCwd)) {
      throw new Error(`[vuecloakify] Refusing to clean unsafe ${label}: ${directory}`);
    }

    for (const source of canonicalSources) {
      if (pathsOverlap(directory, source.directory)) {
        throw new Error(`[vuecloakify] ${label} must not overlap ${source.label}: ${directory}`);
      }
    }
  }

  if (pathsOverlap(canonicalOutDir, canonicalTempDir)) {
    throw new Error("[vuecloakify] outDir and tempDir must not overlap.");
  }
}

/** Resolves a template from a file path, inline contents, or the bundled default. */
function resolveTemplate(value: string | undefined, cwd: string, bundledFile: string): string {
  if (value) {
    const asPath = path.isAbsolute(value) ? value : path.resolve(cwd, value);
    if (fs.existsSync(asPath) && fs.statSync(asPath).isFile()) return fs.readFileSync(asPath, "utf-8");
    return value; // Treat a non-file value as inline template contents.
  }
  return fs.readFileSync(path.resolve(bundledTemplatesDir, bundledFile), "utf-8");
}

function validateTemplateContracts(htmlTemplate: string, entryTemplate: string): void {
  const requiredHtmlMarkers = ["<!--headTags-->", "<!--cssLinks-->", "<!--clientScriptPath-->"];
  const missingMarkers = requiredHtmlMarkers.filter((marker) => !htmlTemplate.includes(marker));
  if (missingMarkers.length > 0) {
    throw new Error(`[vuecloakify] htmlTemplate is missing required marker(s): ${missingMarkers.join(", ")}`);
  }
  if (!entryTemplate.includes("PAGE_COMPONENT_IMPORT")) {
    throw new Error("[vuecloakify] entryTemplate is missing the required PAGE_COMPONENT_IMPORT placeholder.");
  }
}

/**
 * Builds a Keycloak theme from Vue sources: prerenders login pages into
 * `*.ftl`, compiles email templates from MJML to FTL, and copies static files.
 * The resulting `outDir` can be served as `/opt/keycloak/themes/<name>` or
 * packaged into a theme provider JAR.
 */
export async function buildKeycloakTheme(options: BuildKeycloakThemeOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const themeSource = path.resolve(cwd, options.themeSource ?? "src/theme");
  const outDir = path.resolve(cwd, options.outDir ?? "dist");
  const tempDir = path.resolve(cwd, options.tempDir ?? ".vuecloakify");
  const debug = options.debug ?? false;

  const publicDir = options.publicDir === null ? null : options.publicDir ?? "public";
  const publicSource = publicDir ? path.resolve(cwd, publicDir) : null;

  const loginDir = options.loginDir === null ? null : options.loginDir ?? "login";
  const loginSource = loginDir ? path.resolve(themeSource, loginDir) : null;
  const emailDir = options.emailDir === null ? null : options.emailDir ?? "email";
  const emailSource = emailDir ? path.resolve(themeSource, emailDir) : null;

  const sources = [
    { label: "themeSource", directory: themeSource },
    ...(loginSource ? [{ label: "loginDir", directory: loginSource }] : []),
    ...(emailSource ? [{ label: "emailDir", directory: emailSource }] : []),
    ...(publicSource ? [{ label: "publicDir", directory: publicSource }] : []),
  ];
  assertSafeBuildDirectories({ cwd, sources, outDir, tempDir });

  const htmlTemplate = resolveTemplate(options.htmlTemplate, cwd, "template.html");
  const entryTemplate = resolveTemplate(options.entryTemplate, cwd, "entry.ts");
  validateTemplateContracts(htmlTemplate, entryTemplate);

  cleanDirectory(tempDir, true);
  try {
    cleanDirectory(outDir, true);

    const validate = options.validatePageNames ?? true;

    if (loginSource) {
      if (fs.existsSync(loginSource)) {
        if (validate) {
          const names = fs
            .readdirSync(loginSource)
            .filter((file) => file.endsWith(".vue"))
            .map((file) => path.basename(file, ".vue"))
            .sort();
          warnUnknownTemplates(names, "login");
        }
        await prerender(
          {
            source: loginSource,
            dist: path.resolve(outDir, "login"),
            temp: fs.mkdtempSync(path.resolve(tempDir, "login-")),
          },
          { cwd, htmlTemplate, entryTemplate, debug },
        );
      } else {
        console.warn(`[vuecloakify] Login source directory not found: ${loginSource}`);
      }
    }

    if (emailSource) {
      if (validate && fs.existsSync(emailSource)) {
        const names = fs
          .readdirSync(emailSource)
          .filter((file) => file.endsWith(".mjml"))
          .map((file) => path.basename(file, ".mjml"))
          .sort();
        warnUnknownTemplates(names, "email");
      }
      await buildEmail(emailSource, path.resolve(outDir, "email/html"));
    }

    if (publicSource) copyDir(publicSource, outDir);

    console.log(`[vuecloakify] Theme built at ${outDir}`);
  } finally {
    cleanDirectory(tempDir);
  }
}

/** Provides type inference for `vuecloakify.config.ts`. */
export function defineConfig(options: BuildKeycloakThemeOptions): BuildKeycloakThemeOptions {
  return options;
}
