import type {
  SQLTemplate,
  ResultOf,
  SchemaOf,
  Coercer,
  Schema,
  SQL,
} from "./types";
import { schema } from "./types";

function createSQL<TSchema extends Schema>(
  definition: string
): SQLTemplate<TSchema, never>;
function createSQL<TSchema extends Schema>(
  definition: string,
  run?: (sql: string, params: any[]) => Promise<unknown[]>
): SQLTemplate<TSchema, true>;
function createSQL<TSchema extends Schema>(
  definition: string,
  run?: (sql: string, params: any[]) => unknown[]
): SQLTemplate<TSchema, false>;

function createSQL<TSchema extends Schema>(
  definition: string,
  run?: (sql: string, params: any[]) => Promise<unknown[]> | unknown[]
) {
  const queries = definition
    .split(";") // TODO: handle nested ';' (e.g. for triggers)
    .filter((x) => x.trim())
    .map((x) => template([x]));

  const sql = Object.assign(template, {
    schema: queries,
    column: quote,
    table: quote,
    values,
  });

  if (!run) return sql;
  Object.assign(sql.schema, {
    then(resolve?: (_: unknown) => unknown, reject?: (_: unknown) => void) {
      const results = queries.map((x) => (x as any).then());
      if (!results.length || Array.isArray(results[0])) {
        return resolve ? resolve(results) : results;
      }
      return Promise.all(results).then(resolve, reject);
    },
  });
  return sql;

  function template(
    this: { coercer: Coercer<unknown, unknown> } | void,
    strings: readonly string[],
    ...values: unknown[]
  ) {
    const params = values.slice();
    let last = 0;
    const sql = strings.reduce((a, b, i) => {
      last += 1;
      const param = values[i - 1];
      if (!isSQL(param)) return a + "?" + b;
      params.splice(last - 1, 1, ...param.params);
      last += param.params.length - 1;
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
      [schema]: null as any as TSchema,
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
  }

  function quote(text: string) {
    const char = '"';
    if (!text.includes(char)) return template([char + text + char]);
    return template([char + text.split(char).join(char + char) + char]);
  }

  function values(...data: Record<string, unknown>[] | unknown[][]) {
    if (!data.length) throw new Error("No values were provided!");
    if (Array.isArray(data[0])) {
      const row = `(${Array(data[0].length).fill("?").join(",")})`;
      const snippet = `VALUES ` + Array(data.length).fill(row).join(",");
      return template(snippet.split("?"), ...data.flat());
    } else {
      const keys = Object.keys(data[0]);
      const columns = keys.map(quote);
      const row = `(${Array(columns.length).fill("?").join(",")})`;
      const snippet = row + ` VALUES ` + Array(data.length).fill(row).join(",");
      return template(
        snippet.split("?"),
        ...columns.concat(data.flatMap((x: any) => keys.map((key) => x[key])))
      );
    }
  }
}

function isSQL(value: unknown): value is SQL<{}, unknown> {
  return !!(value && typeof value === "object" && schema in value);
}

export { createSQL };
export type { SchemaOf, ResultOf };
