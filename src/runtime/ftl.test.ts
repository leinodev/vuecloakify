import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateFtlWithEnvironment,
  ftlString,
  ftlBoolean,
  ftlNumber,
  ftlStringArray,
  ftlNumberArray,
  ftlObjectArray,
} from "./ftl.js";

test("string: ?js_string escaping + has_content guard + JSON default", () => {
  const ftl = generateFtlWithEnvironment({ name: ftlString({ field: "realm.name", default: "x" }) });
  assert.match(ftl, /"name": <#if \(realm\.name\)\?has_content>"\$\{realm\.name\?js_string\}"<#else>"x"<\/#if>/);
});

test("string default is JSON-escaped (no broken JS from quotes/backslashes)", () => {
  const ftl = generateFtlWithEnvironment({ s: ftlString({ field: "x", default: "a\"b\\c" }) });
  assert.ok(ftl.includes(JSON.stringify("a\"b\\c")), "default must be JSON.stringify'd");
});

test("string without an explicit default stays a string in production", () => {
  const ftl = generateFtlWithEnvironment({ s: ftlString({ field: "missing" }) });
  assert.match(ftl, /<#else>""<\/#if>/);
});

test("inline defaults cannot terminate the generated script", () => {
  const ftl = generateFtlWithEnvironment({ s: ftlString({ field: "x", default: "</script>\u2028" }) });
  assert.doesNotMatch(ftl, /<\/script>/i);
  assert.match(ftl, /\\u003c\/script>/);
  assert.match(ftl, /\\u2028/);
});

test("inline defaults and schema keys cannot introduce FreeMarker interpolation", () => {
  const ftl = generateFtlWithEnvironment({
    "${schemaKey}": ftlString({ field: "x", default: "${7 * 7} #{8} [=9]" }),
  });

  assert.doesNotMatch(ftl, /\$\{schemaKey}|\$\{7 \* 7}|#\{8}|\[=9]/);
  assert.match(ftl, /\\u0024\{schemaKey}/);
  assert.match(ftl, /\\u0024\{7 \* 7}/);
  assert.match(ftl, /\\u0023\{8}/);
  assert.match(ftl, /\[\\u003d9]/);
});

test("boolean uses ?c and false default", () => {
  const ftl = generateFtlWithEnvironment({ reg: ftlBoolean({ field: "realm.registrationAllowed" }) });
  assert.match(ftl, /\$\{\(realm\.registrationAllowed\)\?c\}/);
  assert.match(ftl, /<#else>false<\/#if>/);
});

test("number uses locale-independent computer formatting", () => {
  const ftl = generateFtlWithEnvironment({ n: ftlNumber({ field: "x", default: 7 }) });
  assert.match(ftl, /"n": <#if \(x\)\?has_content>\$\{\(x\)\?c\}<#else>7<\/#if>/);
});

test("number[] uses locale-independent computer formatting", () => {
  const ftl = generateFtlWithEnvironment({ values: ftlNumberArray({ field: "values" }) });
  assert.match(ftl, /<#list values as _i0>\$\{\(_i0\)\?c\}/);
});

test("string[] lists items with js_string and JSON default", () => {
  const ftl = generateFtlWithEnvironment({ locales: ftlStringArray({ field: "realm.locales", default: ["en"] }) });
  assert.match(ftl, /<#list realm\.locales as _i0>"\$\{_i0\?js_string\}"<#if _i0_has_next>, <\/#if><\/#list>/);
  assert.match(ftl, /<#else>\["en"\]<\/#if>/);
});

test("object[]: per-item field types preserved + loop var scoping", () => {
  const ftl = generateFtlWithEnvironment({
    providers: ftlObjectArray({
      field: "social.providers",
      itemConfig: { alias: ftlString({ field: "alias" }), enabled: ftlBoolean({ field: "enabled" }) },
    }),
  });
  assert.match(ftl, /<#list social\.providers as _i0>\{/);
  assert.match(ftl, /"alias": <#if \(_i0\.alias\)\?has_content>"\$\{_i0\.alias\?js_string\}"/);
  assert.match(ftl, /"enabled": <#if \(_i0\.enabled\)\?has_content>\$\{\(_i0\.enabled\)\?c\}/);
});

test("nested object[] uses distinct loop variables", () => {
  const ftl = generateFtlWithEnvironment({
    groups: ftlObjectArray({
      field: "groups",
      itemConfig: {
        name: ftlString({ field: "name" }),
        items: ftlObjectArray({ field: "items", itemConfig: { id: ftlString({ field: "id" }) } }),
      },
    }),
  });
  assert.match(ftl, /<#list groups as _i0>/);
  assert.match(ftl, /<#list _i0\.items as _i1>/);
});

test("schema keys are safely serialized and field/type can be nested keys", () => {
  const ftl = generateFtlWithEnvironment({
    "unsafe\"</script>": ftlString({ field: "x" }),
    "meta": {
      field: ftlString({ field: "a" }),
      type: ftlString({ field: "b" }),
    },
  });

  assert.doesNotMatch(ftl, /<\/script>/i);
  assert.match(ftl, /"unsafe\\"\\u003c\/script>":/);
  assert.match(ftl, /"meta": \{ "field":/);
  assert.match(ftl, /, "type":/);
});

test("serializes __proto__ as a computed own property", () => {
  const ftl = generateFtlWithEnvironment({
    ["__proto__"]: ftlString({ field: "value" }),
    nested: { ["__proto__"]: ftlString({ field: "nestedValue" }) },
  });

  assert.match(ftl, /\["__proto__"]: <#if \(value\)\?has_content>/);
  assert.match(ftl, /"nested": \{ \["__proto__"]: <#if \(nestedValue\)\?has_content>/);
});

test("merges generated __proto__ with own-property semantics at runtime", () => {
  const ftl = generateFtlWithEnvironment({ ["__proto__"]: {} });
  const javaScript = ftl.replace("<#noautoesc>", "").replace("</#noautoesc>", "");
  const browserWindow: { ENVIRONMENT: Record<string, unknown> } = {
    ENVIRONMENT: { existing: true },
  };

  Function("window", javaScript)(browserWindow);

  assert.equal(browserWindow.ENVIRONMENT.existing, true);
  assert.equal(Object.getPrototypeOf(browserWindow.ENVIRONMENT), Object.prototype);
  assert.equal(Object.hasOwn(browserWindow.ENVIRONMENT, "__proto__"), true);
  assert.deepEqual(browserWindow.ENVIRONMENT.__proto__, {});
});

test("preserves __proto__ and FTL-like text in object-array production fallbacks", () => {
  const dangerousValue = "${7 * 7} #{8} [=9] </script>";
  const fallbackItem = Object.fromEntries([["__proto__", dangerousValue]]) as Record<"__proto__", string>;
  const ftl = generateFtlWithEnvironment({
    items: ftlObjectArray({
      field: "missingItems",
      default: [fallbackItem],
      itemConfig: { ["__proto__"]: ftlString({ field: "__proto__" }) },
    }),
  });
  const fallbackExpression = ftl.match(/<#else>(JSON\.parse\(.*\))<\/#if>/)?.[1];

  assert.ok(fallbackExpression);
  assert.doesNotMatch(fallbackExpression, /\$\{7 \* 7}|#\{8}|\[=9]|<\/script>/i);

  const fallback = Function(`return (${fallbackExpression});`)() as Array<Record<string, unknown>>;
  assert.equal(Object.getPrototypeOf(fallback[0]), Object.prototype);
  assert.equal(Object.hasOwn(fallback[0], "__proto__"), true);
  assert.equal(fallback[0].__proto__, dangerousValue);
});

test("wraps assignment in <#noautoesc> (avoid Keycloak HTML double-escaping)", () => {
  const ftl = generateFtlWithEnvironment({ a: ftlString({ field: "x" }) });
  assert.ok(ftl.startsWith("<#noautoesc>window.ENVIRONMENT = { ...(window.ENVIRONMENT ?? {}),"));
  assert.ok(ftl.endsWith(" };</#noautoesc>"));
});
