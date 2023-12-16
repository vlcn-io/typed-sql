import type {
  CachedRunner,
  AsyncRunner,
  SQLTemplate,
  SyncRunner,
  CacheStats,
  ResultOf,
  SchemaOf,
  Coercer,
  Schema,
  SQL,
} from "./types.js";
import { isPromise, queue } from "./queue.js";
import { schema } from "./types.js";

/** Maximum number of cached prepared statements without references */
const CACHE_LIMIT = 10;

// TODO: update to take in the result of the `schema` tag
// Usage would look like:
// const sql = createSQL(schema`...`, run);
function createSQL<TSchema extends Schema>(
  definition: string
): SQLTemplate<TSchema, never>;
function createSQL<TSchema extends Schema>(
  definition: string,
  prepare?: AsyncRunner
): SQLTemplate<TSchema, true>;
function createSQL<TSchema extends Schema>(
  definition: string,
  prepare?: SyncRunner
): SQLTemplate<TSchema, false>;

function createSQL<TSchema extends Schema>(
  definition: string,
  prepare?: AsyncRunner | SyncRunner
) {
  const cache = new Map<string, CachedRunner>();
  const stats = new Map<string, CacheStats>();
  const registry = new FinalizationRegistry<string>((sql) => {
    if (!stats.has(sql)) return;
    if ((stats.get(sql)!.refs -= 1)) return;

    let candidateStat = { time: Infinity, uses: Infinity };
    let candidateKey = "";
    let hanging = 0;
    stats.forEach((stat, key) => {
      if (stat.refs) return;
      hanging += 1;
      if (
        stat.uses < candidateStat.uses ||
        (stat.uses === candidateStat.uses && stat.time < candidateStat.time)
      ) {
        candidateStat = stat;
        candidateKey = key;
      }
    });

    if (hanging > CACHE_LIMIT) {
      stats.delete(candidateKey);
      cache.delete(candidateKey);
    }
  });

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

  if (!prepare) return sql;
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

    registry.register(compiled, sql);
    if (!stats.has(sql)) stats.set(sql, { refs: 0, uses: 0, time: 0 });
    const stat = stats.get(sql)!;
    stat.time = Date.now();
    stat.refs += 1;

    if (!prepare) return compiled;
    return Object.assign(compiled, {
      then(
        resolve?: (_: unknown) => unknown,
        reject?: (_: unknown) => void
      ): any {
        this.prepare();
        return cache.get(sql)!((execute) => {
          if (isPromise(execute)) {
            return execute
              .then((x) => x(params))
              .then((x) => x.map(coerce))
              .then(resolve, reject);
          }
          try {
            const result = execute(params).map(coerce);
            return resolve ? resolve(result) : result;
          } catch (error) {
            if (reject) return reject(error);
            throw error;
          }
        });
      },
      as<T>(coercer: Coercer<unknown, T>) {
        return template.bind({ coercer })(strings, ...values) as any;
      },
      prepare() {
        stat.uses += 1;
        stat.time = Date.now();
        if (cache.has(sql)) return;
        const prepared = queue(prepare(sql));
        cache.set(sql, prepared);
        if (isPromise(prepared)) return prepared.then(() => undefined);
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
