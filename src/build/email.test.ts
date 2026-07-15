import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildEmail } from "./email.js";

function emailFixture(context: TestContext): {
  source: string;
  dist: string;
} {
  const root = fs.mkdtempSync(path.resolve(os.tmpdir(), "vuecloakify-email-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const source = path.resolve(root, "source");
  fs.mkdirSync(source, { recursive: true });
  return { source, dist: path.resolve(root, "dist") };
}

test("compiles valid MJML and preserves FreeMarker expressions", async (context) => {
  const { source, dist } = emailFixture(context);
  fs.writeFileSync(
    path.resolve(source, "password-reset.mjml"),
    "<mjml><mj-body><mj-raw><#if user??></mj-raw><mj-section><mj-column><mj-text>Hello ${user}</mj-text></mj-column></mj-section><mj-raw></#if></mj-raw></mj-body></mjml>",
  );

  await buildEmail(source, dist);

  const output = fs.readFileSync(path.resolve(dist, "password-reset.ftl"), "utf8");
  assert.match(output, /Hello \$\{user\}/);
  assert.match(output, /<#if user\?\?>/);
  assert.match(output, /<\/#if>/);
});

test("rejects invalid MJML instead of emitting an incomplete email theme", async (context) => {
  const { source, dist } = emailFixture(context);
  fs.writeFileSync(path.resolve(source, "invalid.mjml"), "<mjml><mj-body><unknown /></mj-body></mjml>");

  await assert.rejects(buildEmail(source, dist), /ValidationError|unknown/i);
});
