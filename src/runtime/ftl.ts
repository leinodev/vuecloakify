import type {
  EnvironmentConfig,
  FtlBaseConfig,
  FtlBooleanConfig,
  FtlNumberArrayConfig,
  FtlNumberConfig,
  FtlObjectArrayConfig,
  FtlStringArrayConfig,
  FtlStringConfig,
} from "./types.js";
import { isFtlFieldConfig } from "./guards.js";

/**
 * Pure environment-field factories. They retain both the production `default`
 * fallback and the development `debug` value without depending on
 * `import.meta.env`. The consumer chooses the value:
 * {@link generateFtlWithEnvironment} uses `default`, while
 * `buildDefaultEnvironment` uses `debug ?? default`.
 */

/** A string field mapped to a Keycloak FreeMarker expression. */
export function ftlString(config: Omit<FtlStringConfig, "type">): FtlStringConfig {
  return {
    field: config.field,
    type: "string",
    default: config.default ?? "",
    debug: config.debug,
  };
}

/** A numeric field mapped to a Keycloak FreeMarker expression. */
export function ftlNumber(config: Omit<FtlNumberConfig, "type">): FtlNumberConfig {
  return {
    field: config.field,
    type: "number",
    default: config.default ?? 0,
    debug: config.debug,
  };
}

/** A boolean field, serialized in FreeMarker with `?c`. */
export function ftlBoolean(config: Omit<FtlBooleanConfig, "type">): FtlBooleanConfig {
  return {
    field: config.field,
    type: "boolean",
    default: config.default ?? false,
    debug: config.debug,
  };
}

/** A string array. `formatItem(loopVar)` maps each item to a FreeMarker expression. */
export function ftlStringArray(config: Omit<FtlStringArrayConfig, "type">): FtlStringArrayConfig {
  return {
    field: config.field,
    type: "string[]",
    default: config.default ?? [],
    debug: config.debug,
    formatItem: config.formatItem,
  };
}

/** A numeric array. */
export function ftlNumberArray(config: Omit<FtlNumberArrayConfig, "type">): FtlNumberArrayConfig {
  return {
    field: config.field,
    type: "number[]",
    default: config.default ?? [],
    debug: config.debug,
    formatItem: config.formatItem,
  };
}

/** An object array whose items are described by the nested `itemConfig` schema. */
export function ftlObjectArray<T extends EnvironmentConfig>(
  config: Omit<FtlObjectArrayConfig<T>, "type">,
): FtlObjectArrayConfig<T> {
  return {
    field: config.field,
    type: "object[]",
    default: config.default ?? [],
    debug: config.debug,
    itemConfig: config.itemConfig,
  };
}

/** JSON serialization safe to embed inside an inline script. */
function jsonDefault(value: unknown): string {
  return JSON.stringify(value === undefined ? null : value)
    .replaceAll("<", "\\u003c")
    .replaceAll("$", "\\u0024")
    .replaceAll("#", "\\u0023")
    .replaceAll("=", "\\u003d")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

/** Restores structured JSON with own-property semantics for keys such as `__proto__`. */
function parsedJsonDefault(value: unknown): string {
  const serialized = JSON.stringify(value === undefined ? null : value);
  return `JSON.parse(${jsonDefault(serialized)})`;
}

/** Wraps a value in a FreeMarker `has_content` check with a fallback. */
function guard(expr: string, value: string, def: string): string {
  return `<#if (${expr})?has_content>${value}<#else>${def}</#if>`;
}

/** Builds the FreeMarker snippet for one field. `expr` is its full path, including loop scope. */
function valueFtl(expr: string, value: FtlBaseConfig, depth: number): string {
  switch (value.type) {
    case "string":
      // ?js_string escapes quotes, backslashes, line breaks, and </script> to keep inline JavaScript safe.
      return guard(expr, `"\${${expr}?js_string}"`, jsonDefault(value.default ?? ""));
    case "number":
      return guard(expr, `\${(${expr})?c}`, jsonDefault(value.default ?? 0));
    case "boolean":
      return guard(expr, `\${(${expr})?c}`, jsonDefault(value.default ?? false));
    case "string[]": {
      const lv = `_i${depth}`;
      const el = value.formatItem ? value.formatItem(lv) : lv;
      const body = `[<#list ${expr} as ${lv}>"\${${el}?js_string}"<#if ${lv}_has_next>, </#if></#list>]`;
      return guard(expr, body, jsonDefault(value.default ?? []));
    }
    case "number[]": {
      const lv = `_i${depth}`;
      const el = value.formatItem ? value.formatItem(lv) : lv;
      const body = `[<#list ${expr} as ${lv}>\${(${el})?c}<#if ${lv}_has_next>, </#if></#list>]`;
      return guard(expr, body, jsonDefault(value.default ?? []));
    }
    case "object[]": {
      const cfg = value as FtlObjectArrayConfig<EnvironmentConfig>;
      const lv = `_i${depth}`;
      // Item fields are scoped through the loop variable: `_iN.<field>`.
      const inner = buildFtlObject(cfg.itemConfig, `${lv}.`, depth + 1);
      const body = `[<#list ${expr} as ${lv}>{ ${inner} }<#if ${lv}_has_next>, </#if></#list>]`;
      return guard(expr, body, parsedJsonDefault(value.default ?? []));
    }
    default:
      return "null";
  }
}

function buildFtlObject(obj: EnvironmentConfig, prefix: string, depth: number): string {
  return Object.entries(obj)
    .map(([key, value]) => {
      const serializedKey = jsonDefault(key);
      // `__proto__` has setter semantics in an object literal unless it is a
      // computed property. Other JSON-serialized keys can use normal syntax.
      const propertyKey = key === "__proto__" ? `[${serializedKey}]` : serializedKey;
      if (!isFtlFieldConfig(value)) return `${propertyKey}: { ${buildFtlObject(value, prefix, depth)} }`;
      return `${propertyKey}: ${valueFtl(prefix + value.field, value, depth)}`;
    })
    .join(", ");
}

/**
 * Converts an environment schema into the JavaScript snippet
 * `window.ENVIRONMENT = { ...(window.ENVIRONMENT ?? {}), … }`,
 * with values interpolated by FreeMarker from the Keycloak context. Strings are
 * escaped with `?js_string`; fallback values are serialized with `JSON.stringify`.
 *
 * The assignment is wrapped in `<#noautoesc>` because Keycloak renders themes
 * with HTML auto-escaping. Without it, already JavaScript-escaped values would
 * be escaped again (`&` to `&amp;`, `"` to `&quot;`), corrupting URLs such as
 * `url.loginAction` and potentially the script itself. `?js_string` keeps the
 * JavaScript string safe; `<#noautoesc>` prevents the extra HTML escaping.
 */
export function generateFtlWithEnvironment(config: EnvironmentConfig): string {
  // Object spread uses CreateDataProperty semantics. Unlike Object.assign into
  // an ordinary object, it preserves an own `__proto__` key without invoking
  // the target object's legacy prototype setter.
  return `<#noautoesc>window.ENVIRONMENT = { ...(window.ENVIRONMENT ?? {}), ${buildFtlObject(config, "", 0)} };</#noautoesc>`;
}
