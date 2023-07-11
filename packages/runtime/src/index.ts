import type { Coercer, ResultOf, SQL, SchemaOf } from "./types";
import { schema } from "./types";

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

  return function template(
    this: { coercer: Coercer<unknown, unknown> } | void,
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) {
    const params = values.slice();
    const sql = strings.reduce((a, b, i) => {
      const param = values[i - 1];
      if (!isSQL(param)) return a + "?" + b;
      params.splice(i - 1, 1, ...param.params);
      return a + param.sql + b;
    });
    const coerce = !this
      ? <T>(x: T) => x
      : "create" in this.coercer
      ? this.coercer.create
      : "parse" in this.coercer
      ? this.coercer.parse
      : this.coercer;

    const compiled = {
      sql,
      params,
      [schema]: null as TSchema,
    };

    if (!run) return compiled;
    return Object.assign(compiled, {
      then(
        resolve?: (_: unknown) => unknown,
        reject?: (_: unknown) => void
      ): any {
        try {
          const result = run?.(sql, params);
          if (Array.isArray(result)) {
            return resolve ? resolve(result.map(coerce)) : result.map(coerce);
          }
          if (result && typeof result === "object" && "then" in result) {
            return result.then((x) => x.map(coerce)).then(resolve, reject);
          }
        } catch (error) {
          if (reject) return reject(error);
          throw error;
        }
      },
      as<T>(coercer: Coercer<unknown, T>) {
        return template.bind({ coercer })(strings, ...values) as any;
      },
    });
  };
}

function isSQL(value: unknown): value is SQL<unknown, unknown> {
  return !!(value && typeof value === "object" && schema in value);
}

export { createSQL };
export type { SchemaOf, ResultOf };
