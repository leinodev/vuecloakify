import { test } from "node:test";
import assert from "node:assert/strict";
import { ftlFieldErrors, kcLoginContext, kcSocialProviders } from "./context.js";
import { generateFtlWithEnvironment } from "./ftl.js";
import { buildDefaultEnvironment } from "./default-env.js";

test("ftlFieldErrors builds error + hasError per field with correct FTL", () => {
  const errs = ftlFieldErrors(["username", "password"]);
  assert.equal(errs.username.error.field, "messagesPerField.get('username')");
  assert.equal(errs.username.hasError.field, "messagesPerField.existsError('username')");
  assert.equal(errs.password.error.type, "string");
  assert.equal(errs.password.hasError.type, "boolean");

  const ftl = generateFtlWithEnvironment(errs);
  assert.match(ftl, /messagesPerField\.existsError\('username'\)/);
  assert.match(ftl, /messagesPerField\.get\('password'\)\?js_string/);
});

test("kcLoginContext generates valid FTL and resolves debug defaults", () => {
  const ftl = generateFtlWithEnvironment(kcLoginContext);
  assert.match(ftl, /"name": <#if \(realm\.name\)\?has_content>/);
  assert.match(ftl, /\$\{\(realm\.registrationAllowed\)\?c\}/);

  const env = buildDefaultEnvironment(kcLoginContext);
  assert.equal(env.realm.name, "example");
  assert.equal(env.realm.registrationAllowed, true);
  assert.equal(env.locale.current, "en");
});

test("kcSocialProviders is an object[] over social.providers", () => {
  const ftl = generateFtlWithEnvironment({ social: kcSocialProviders });
  assert.match(ftl, /<#list social\.providers as _i0>/);
  assert.match(ftl, /"loginUrl": <#if \(_i0\.loginUrl\)\?has_content>/);
});

test("ftlFieldErrors escapes field names as FreeMarker string literals", () => {
  const errors = ftlFieldErrors(["user'name\\part", "${7 * 7}", "#{8}", "[=9]", "__proto__"]);
  const ftl = generateFtlWithEnvironment(errors);
  assert.match(ftl, /messagesPerField\.get\('user\\'name\\\\part'\)/);
  assert.match(ftl, /messagesPerField\.existsError\('user\\'name\\\\part'\)/);
  assert.match(ftl, /messagesPerField\.get\('\$\\\{7 \* 7}'\)/);
  assert.match(ftl, /messagesPerField\.get\('#\\\{8}'\)/);
  assert.match(ftl, /messagesPerField\.get\('\[\\=9]'\)/);
  assert.equal(Object.hasOwn(errors, "__proto__"), true);
  assert.equal(errors.__proto__.error.field, "messagesPerField.get('__proto__')");
  assert.match(ftl, /\["__proto__"]: \{ "error": <#if \(messagesPerField\.get\('__proto__'\)\)\?has_content>/);
});
