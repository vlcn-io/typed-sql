const schema = Symbol();

function createSQL<TSchema>(
  definition: string
): (strings: TemplateStringsArray, ...values: unknown[]) => SQL<TSchema, never>;
function createSQL<TSchema>(
  definition: string,
  run?: (sql: string, params: any[]) => Promise<unknown[]>
): <TResult>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => SQL<TSchema, TResult>;
function createSQL<TSchema>(
  definition: string,
  run?: (sql: string, params: any[]) => unknown[]
): <TResult>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => SQL<TSchema, TResult, false>;

function createSQL<TSchema>(
  definition: string,
  run?: (sql: string, params: any[]) => Promise<unknown[]> | unknown[]
) {
  if (run) {
    definition
      .split(";") // TODO: handle nested ';' (e.g. for triggers)
      .filter((x) => x.trim())
      .map((x) => Promise.resolve(run?.(x, [])));
  }

  return (strings: TemplateStringsArray, ...values: unknown[]) => {
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
      then(
        resolve?: (_: unknown) => unknown,
        reject?: (_: unknown) => void
      ): any {
        try {
          const result = run?.(sql, params);
          if (Array.isArray(result)) {
            return resolve ? resolve(result) : result;
          }
          if (result && typeof result === "object" && "then" in result) {
            return result.then(resolve, reject);
          }
        } catch (error) {
          if (reject) return reject(error);
          throw error;
        }
      },
    };
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

type SQL<TSchema, TResult, Async = true> = {
  sql: string;
  params: unknown[]; // We cannot infer those with code-gen...
  [schema]: TSchema;
} & ([TResult] extends [never]
  ? {}
  : Async extends true
  ? PromiseLike<TResult[]>
  : SyncPromise<TResult[]>);

type SyncPromise<T> = {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1) | undefined | null,
    onrejected?: ((reason: any) => TResult2) | undefined | null
  ): TResult1 | TResult2;
};

type SchemaOf<P> = P extends SQL<infer T, any, any>
  ? T
  : P extends (..._: any[]) => SQL<infer T, any, any>
  ? T
  : never;

type ResultOf<P> = P extends SQL<any, infer T, any> ? Awaited<T>[] : never;

export { createSQL };
export type { SchemaOf, ResultOf };
