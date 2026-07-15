import { test } from "node:test";
import assert from "node:assert/strict";
import { fixResourcesPath } from "./resources.js";

test("rewrites debug assets under the supplied theme base path", () => {
  assert.equal(fixResourcesPath(true, "resources/app.js", "login"), "/login/resources/app.js");
  assert.equal(fixResourcesPath(true, "/assets/app.css", "login"), "/login/resources/app.css");
  assert.equal(fixResourcesPath(true, "resources/app.js", "login$&preview"), "/login$&preview/resources/app.js");
});

test("rewrites production assets to the Keycloak resources expression during SSR", () => {
  assert.equal(fixResourcesPath(false, "/resources/app.js", "login"), "${url.resourcesPath}/app.js");
});
