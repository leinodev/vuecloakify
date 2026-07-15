import * as fs from "node:fs";
import path from "node:path";
import { cleanDirectory } from "./fs.js";

/**
 * Compiles MJML email templates (`*.mjml`) into FreeMarker-compatible HTML
 * (`*.ftl`). The `mjml` peer dependency is only required when email templates
 * are present.
 */
export async function buildEmail(source: string, dist: string): Promise<void> {
  if (!fs.existsSync(source)) return;

  const files = fs.readdirSync(source).filter((file) => file.endsWith(".mjml")).sort();
  if (files.length === 0) return;

  let mjml2html: (input: string, options: { filePath: string; validationLevel: "strict" }) => { html: string };
  try {
    const mjmlPackage = "mjml";
    mjml2html = (await import(mjmlPackage)).default as unknown as typeof mjml2html;
  } catch (cause) {
    throw new Error(
      "[vuecloakify] Email templates were found, but the optional 'mjml' peer dependency is not installed.",
      { cause },
    );
  }

  cleanDirectory(dist, true);
  for (const file of files) {
    const sourceFile = path.resolve(source, file);
    const outputFile = `${file.slice(0, -".mjml".length)}.ftl`;
    const template = fs.readFileSync(sourceFile, "utf8");
    const result = mjml2html(template, { filePath: sourceFile, validationLevel: "strict" });
    fs.writeFileSync(path.resolve(dist, outputFile), result.html, "utf8");
    console.log(`[vuecloakify] Email template: ${file} → ${outputFile}`);
  }
}
