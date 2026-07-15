import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readClientManifest } from "./manifest.js";

function withManifest(contents: string | null, callback: (manifestPath: string) => void): void {
  const directory = fs.mkdtempSync(path.resolve(os.tmpdir(), "vuecloakify-manifest-"));
  try {
    const manifestPath = path.resolve(directory, "manifest.json");
    if (contents !== null) fs.writeFileSync(manifestPath, contents);
    callback(manifestPath);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("rejects a missing or invalid client manifest", () => {
  withManifest(null, (manifestPath) => {
    assert.throws(() => readClientManifest(manifestPath, ["login"]), /manifest was not generated/);
  });
  withManifest("not JSON", (manifestPath) => {
    assert.throws(() => readClientManifest(manifestPath, ["login"]), /Invalid Vite client manifest JSON/);
  });
  withManifest("[]", (manifestPath) => {
    assert.throws(() => readClientManifest(manifestPath, ["login"]), /Invalid Vite client manifest/);
  });
});

test("requires an output file for every route entry", () => {
  withManifest("{}", (manifestPath) => {
    assert.throws(() => readClientManifest(manifestPath, ["login"]), /has no entry for route "login"/);
  });
  withManifest("{\"entry.ts\":{\"name\":\"login\",\"isEntry\":true}}", (manifestPath) => {
    assert.throws(() => readClientManifest(manifestPath, ["login"]), /has no output file/);
  });
  withManifest("{\"entry.ts\":{\"file\":\"resources/login.js\",\"name\":\"login\",\"isEntry\":true}}", (manifestPath) => {
    assert.equal(readClientManifest(manifestPath, ["login"])["entry.ts"]?.file, "resources/login.js");
  });
});

test("supports Vite 5.0 manifests whose entry chunks have no name", () => {
  const viteFiveManifest = JSON.stringify({
    ".vuecloakify/entries/login-entry.ts": {
      file: "resources/login-entry-legacy.js",
      src: ".vuecloakify/entries/login-entry.ts",
      isEntry: true,
    },
  });

  withManifest(viteFiveManifest, (manifestPath) => {
    const manifest = readClientManifest(manifestPath, ["login"]);
    assert.equal(
      manifest[".vuecloakify/entries/login-entry.ts"]?.file,
      "resources/login-entry-legacy.js",
    );
  });
});

test("does not guess between ambiguous legacy manifest entries", () => {
  const ambiguousManifest = JSON.stringify({
    "first/login-entry.ts": { file: "resources/first.js", isEntry: true },
    "second/login-entry.ts": { file: "resources/second.js", isEntry: true },
  });

  withManifest(ambiguousManifest, (manifestPath) => {
    assert.throws(() => readClientManifest(manifestPath, ["login"]), /has no entry for route "login"/);
  });
});
