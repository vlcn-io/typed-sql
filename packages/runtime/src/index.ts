const schema = Symbol();

async function createSQL<TSchema>(
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

function isSQL(value: unknown): value is SQL<unknown, unknown> {
  return !!(value && typeof value === "object" && schema in value);
}

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
} & ([TResult] extends [never] ? {} : PromiseLike<TResult[]>);

type Schema<P> = P extends SQL<infer T, any>
  ? T
  : P extends (..._: any[]) => SQL<infer T, any>
  ? T
  : never;

export { createSQL };
export type { Schema };
