/** Supported scalar and collection types in a FreeMarker-backed environment. */
export type FtlFieldType = "string" | "number" | "boolean" | "string[]" | "number[]" | "object[]";

/** Common metadata for one field mapped to a Keycloak FreeMarker expression. */
interface FtlValueConfig<TType extends FtlFieldType, TValue> {
  /** A trusted FreeMarker expression, for example `realm.name` or `url.resourcesPath`. */
  field: string;
  /** Discriminator used to serialize the field and infer its runtime type. */
  type: TType;
  /** Production fallback used when the FreeMarker expression has no content. */
  default?: TValue;
  /** Value used by the local Vite preview and the temporary SSR pass. */
  debug?: TValue;
}

export type FtlStringConfig = FtlValueConfig<"string", string>;

export type FtlNumberConfig = FtlValueConfig<"number", number>;

export type FtlBooleanConfig = FtlValueConfig<"boolean", boolean>;

export interface FtlStringArrayConfig extends FtlValueConfig<"string[]", string[]> {
  /** Maps the FreeMarker loop variable to the expression serialized for each item. */
  formatItem?: (loopVar: string) => string;
}

export interface FtlNumberArrayConfig extends FtlValueConfig<"number[]", number[]> {
  /** Maps the FreeMarker loop variable to the expression serialized for each item. */
  formatItem?: (loopVar: string) => string;
}

/** A recursive environment schema: leaves are field configs and nodes are nested schemas. */
export type EnvironmentConfig = {
  [key: string]: FtlBaseConfig | EnvironmentConfig;
};

/** An array of FreeMarker objects whose individual fields are described by `itemConfig`. */
export interface FtlObjectArrayConfig<T extends EnvironmentConfig = EnvironmentConfig>
  extends FtlValueConfig<"object[]", EnvironmentType<T>[]> {
  itemConfig: T;
}

/** A sound discriminated union of every supported environment leaf. */
export type FtlBaseConfig =
  | FtlStringConfig
  | FtlNumberConfig
  | FtlBooleanConfig
  | FtlStringArrayConfig
  | FtlNumberArrayConfig
  | FtlObjectArrayConfig;

/** Schema accepted by `useEnvironment`; `resourcesPath` is reserved by the runtime. */
export type EnvironmentSchema = EnvironmentConfig & { resourcesPath?: never };

/** Maps one field descriptor to the value exposed to application code. */
export type FtlTypeMapping<T extends FtlBaseConfig> = T extends FtlStringConfig
  ? string
  : T extends FtlNumberConfig
    ? number
    : T extends FtlBooleanConfig
      ? boolean
      : T extends FtlStringArrayConfig
        ? string[]
        : T extends FtlNumberArrayConfig
          ? number[]
          : T extends FtlObjectArrayConfig<infer R>
            ? EnvironmentType<R>[]
            : never;

/** The fully resolved, type-safe value inferred from an environment schema. */
export type EnvironmentType<T extends EnvironmentConfig> = {
  [K in keyof T]: T[K] extends FtlBaseConfig
    ? FtlTypeMapping<T[K]>
    : T[K] extends EnvironmentConfig
      ? EnvironmentType<T[K]>
      : never;
};
