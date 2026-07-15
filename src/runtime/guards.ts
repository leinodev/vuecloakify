import type { FtlBaseConfig } from "./types.js";

const FTL_FIELD_TYPES = new Set(["string", "number", "boolean", "string[]", "number[]", "object[]"]);

/** Distinguishes a field descriptor from a nested schema, even when a schema uses `field` or `type` as a key. */
export function isFtlFieldConfig(value: unknown): value is FtlBaseConfig {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.field === "string"
    && typeof candidate.type === "string"
    && FTL_FIELD_TYPES.has(candidate.type)
  );
}
