type Opaque<BaseType, BrandType = unknown> = BaseType & {
  readonly [Symbols.base]: BaseType;
  readonly [Symbols.brand]: BrandType;
};

namespace Symbols {
  export declare const base: unique symbol;
  export declare const brand: unique symbol;
  export declare const internal: unique symbol;
}

type SchemaType<TSchema> = {
  sql<TResult>(strings: TemplateStringsArray, ...values: any[]): Query<TResult>;
  __content: string;
  __type: TSchema;
};

// This can be used to flatten params of nested queries, but
//  parameter inference cannot be used with generic code-gen:
//  https://github.com/microsoft/TypeScript/issues/26242
// type Flatten<T extends any[]> = T extends [infer U, ...infer R]
//   ? U extends SQL<any, infer TParams, any>
//     ? [...Flatten<U["params"]>, ...Flatten<R>]
//     : [U, ...Flatten<R>]
//   : [];

type SQL<TSchema, TResult> = {
  sql: string;
  params: unknown[]; // We cannot infer those with code-gen...
  [schema]: TSchema;
} & PromiseLike<TResult[]>;

export type Schema<P> = P extends SQL<infer T, any>
  ? T
  : P extends (..._: any[]) => SQL<infer T, any>
  ? T
  : never;

const schema = Symbol();

export type ExtractResultType<P> = P extends Query<infer T> ? T : never;
export type Query<T> = Opaque<string, T>;
export type RecordTypes<P> = P extends SchemaType<infer T> ? T : never;
export function declareSchema<TSchema>(strings: TemplateStringsArray, ...values: any[]): SchemaType<TSchema> {
  const content = processTemplateStrings(strings, values);
  return {
    sql<T>(strings: TemplateStringsArray, ...values: any[]): Query<T> {
      return processTemplateStrings(strings, values) as Query<T>;
    },
    __content: content,
    __type: null as TSchema,
  };
}
export async function createSQL<TSchema>(
  run: (sql: string, params: any[]) => Promise<unknown[]>,
  definition: string
) {
  // TODO: handle nested ';' (e.g. for triggers)
  await Promise.all(
    definition
      .split(";")
      .filter((x) => x.trim())
      .map((x) => run(x, []))
  );

  return <TResult>(strings: TemplateStringsArray, ...values: unknown[]) => {
    const params = values.slice();
    const sql = strings.reduce((a, b, i) => {
      const param = values[i - 1];
      if (!isSQL(param)) return a + "?" + b;
      params.splice(i - 1, 1, ...param.params);
      return a + param.sql + b;
    });

    return {
      sql,
      params,
      [schema]: null as TSchema,
      then(onfulfilled, onrejected) {
        return Promise.resolve(run(sql, params)).then(
          onfulfilled as any,
          onrejected
        );
      },
    } satisfies SQL<TSchema, TResult>;
  };
}

function processTemplateStrings(strings: TemplateStringsArray, values: any[]) {
  let str = '';
  strings.forEach((string, i) => {
    str += string + (values[i] || '');
  });
  return str;
}

function isSQL(value: unknown): value is SQL<unknown, unknown> {
  return !!(value && typeof value === "object" && schema in value);
}
