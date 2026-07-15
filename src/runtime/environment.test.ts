import { test } from "node:test";
import assert from "node:assert/strict";
import { VUECLOAKIFY_BUILD_CONTEXT, type VuecloakifyBuildState } from "./build-context.js";
import { useEnvironment } from "./environment.js";
import { ftlString } from "./ftl.js";

function withBuildState(state: VuecloakifyBuildState, callback: () => void): void {
  const buildGlobal = globalThis as typeof globalThis & Record<symbol, unknown>;
  const hadBuildContext = Object.prototype.hasOwnProperty.call(buildGlobal, VUECLOAKIFY_BUILD_CONTEXT);
  const previousBuildContext = buildGlobal[VUECLOAKIFY_BUILD_CONTEXT];
  buildGlobal[VUECLOAKIFY_BUILD_CONTEXT] = { getStore: () => state };
  try {
    callback();
  } finally {
    if (hadBuildContext) buildGlobal[VUECLOAKIFY_BUILD_CONTEXT] = previousBuildContext;
    else delete buildGlobal[VUECLOAKIFY_BUILD_CONTEXT];
  }
}

test("uses the injected build context when native Node ESM has no import.meta.env", () => {
  withBuildState({ debug: true, environmentScripts: [] }, () => {
    const environment = useEnvironment({ greeting: ftlString({ field: "greeting", debug: "hello" }) });
    assert.equal(environment.greeting, "hello");
    assert.equal(environment.resourcesPath, "");
  });
});

test("registers the production FTL environment without a Vue head plugin", () => {
  const state: VuecloakifyBuildState = { debug: false, environmentScripts: [] };
  withBuildState(state, () => {
    useEnvironment({ greeting: ftlString({ field: "realm.displayName" }) });
  });

  assert.equal(state.environmentScripts.length, 1);
  assert.match(state.environmentScripts[0] ?? "", /window\.ENVIRONMENT/);
  assert.match(state.environmentScripts[0] ?? "", /realm\.displayName/);
});

test("rejects the reserved resourcesPath key at runtime", () => {
  assert.throws(
    () => useEnvironment({ resourcesPath: ftlString({ field: "custom" }) } as never),
    /resourcesPath.*reserved/,
  );
});
