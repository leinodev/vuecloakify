import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultEnvironment } from "./default-env.js";
import { ftlString, ftlBoolean, ftlStringArray } from "./ftl.js";

test("prefers debug over default, recurses into nested objects", () => {
  const env = buildDefaultEnvironment({
    a: ftlString({ field: "x", default: "prod", debug: "dev" }),
    b: ftlBoolean({ field: "y", default: false, debug: true }),
    list: ftlStringArray({ field: "z", default: ["p"], debug: ["d"] }),
    nested: { c: ftlString({ field: "w", default: "p" }) },
  });
  assert.equal(env.a, "dev");
  assert.equal(env.b, true);
  assert.deepEqual(env.list, ["d"]);
  assert.equal(env.nested.c, "p");
});

test("falls back to type-appropriate empty when no debug/default", () => {
  const env = buildDefaultEnvironment({
    s: ftlString({ field: "x" }),
    b: ftlBoolean({ field: "y" }),
    arr: ftlStringArray({ field: "z" }),
  });
  assert.equal(env.s, "");
  assert.equal(env.b, false);
  assert.deepEqual(env.arr, []);
});

test("treats nested schemas named field and type as objects, not leaf configs", () => {
  const env = buildDefaultEnvironment({
    meta: {
      field: ftlString({ field: "a", debug: "field value" }),
      type: ftlString({ field: "b", debug: "type value" }),
    },
  });

  assert.deepEqual(env.meta, { field: "field value", type: "type value" });
});

test("preserves __proto__ as an own data property without changing the prototype", () => {
  const env = buildDefaultEnvironment({
    ["__proto__"]: ftlString({ field: "value", debug: "safe" }),
    nested: {
      ["__proto__"]: ftlString({ field: "nestedValue", debug: "nested safe" }),
    },
  });

  assert.equal(Object.getPrototypeOf(env), Object.prototype);
  assert.equal(Object.hasOwn(env, "__proto__"), true);
  assert.equal(env.__proto__, "safe");
  assert.equal(Object.getPrototypeOf(env.nested), Object.prototype);
  assert.equal(Object.hasOwn(env.nested, "__proto__"), true);
  assert.equal(env.nested.__proto__, "nested safe");
});
