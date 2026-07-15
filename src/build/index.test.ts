import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildKeycloakTheme, defineConfig } from "./index.js";

function temporaryProject(): string {
  return fs.mkdtempSync(path.resolve(os.tmpdir(), "vuecloakify-safety-"));
}

test("refuses to clean the project root", async () => {
  await assert.rejects(
    buildKeycloakTheme({ cwd: process.cwd(), outDir: ".", publicDir: null }),
    /Refusing to clean unsafe outDir/,
  );
});

test("refuses overlapping output and temporary directories", async () => {
  await assert.rejects(
    buildKeycloakTheme({
      cwd: process.cwd(),
      outDir: ".test-output",
      tempDir: ".test-output/temp",
      publicDir: null,
    }),
    /outDir and tempDir must not overlap/,
  );
});

test("defineConfig preserves the inferred options object", () => {
  const options = { loginDir: null, debug: true } as const;
  assert.equal(defineConfig(options), options);
});

test("refuses loginDir paths that escape themeSource into outDir", async (context) => {
  const cwd = temporaryProject();
  context.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.resolve(cwd, "dist"));
  fs.writeFileSync(path.resolve(cwd, "dist/sentinel"), "keep");

  await assert.rejects(
    buildKeycloakTheme({
      cwd,
      loginDir: "../../dist",
      emailDir: null,
      publicDir: null,
      outDir: "dist",
      tempDir: ".temp",
    }),
    /outDir must not overlap loginDir/,
  );
  assert.equal(fs.readFileSync(path.resolve(cwd, "dist/sentinel"), "utf8"), "keep");
});

test("resolves symlinked sources before validating clean directories", async (context) => {
  const cwd = temporaryProject();
  context.after(() => fs.rmSync(cwd, { recursive: true, force: true }));

  const sourceTarget = path.resolve(cwd, "dist/theme-source");
  const sourceLink = path.resolve(cwd, "src/theme");
  fs.mkdirSync(sourceTarget, { recursive: true });
  fs.mkdirSync(path.dirname(sourceLink), { recursive: true });
  fs.writeFileSync(path.resolve(sourceTarget, "sentinel"), "keep");

  try {
    fs.symlinkSync(sourceTarget, sourceLink, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    context.skip(`Directory symlinks are unavailable: ${String(error)}`);
    return;
  }

  await assert.rejects(
    buildKeycloakTheme({ cwd, emailDir: null, publicDir: null, outDir: "dist", tempDir: ".temp" }),
    /outDir must not overlap themeSource/,
  );
  assert.equal(fs.readFileSync(path.resolve(sourceTarget, "sentinel"), "utf8"), "keep");
});

test("rejects broken custom template contracts before cleaning output", async (context) => {
  const cwd = temporaryProject();
  context.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.resolve(cwd, "dist"));
  fs.writeFileSync(path.resolve(cwd, "dist/sentinel"), "keep");

  await assert.rejects(
    buildKeycloakTheme({
      cwd,
      loginDir: null,
      emailDir: null,
      publicDir: null,
      outDir: "dist",
      tempDir: ".temp",
      htmlTemplate: "<html><head><!--headTags--></head></html>",
    }),
    /htmlTemplate is missing required marker/,
  );
  assert.equal(fs.readFileSync(path.resolve(cwd, "dist/sentinel"), "utf8"), "keep");
});
