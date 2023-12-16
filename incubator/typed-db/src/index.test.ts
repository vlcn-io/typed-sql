import { it, expect, vi } from "vitest";
import { setFlagsFromString } from "v8";
import { createSQL } from "./index.js";
import { runInNewContext } from "vm";

const exec = vi.fn(() => [{ a: "42" }]);
const prepare = vi.fn(() => exec);
const sql = createSQL<{ a: { a: string } }>(`CREATE TABLE a (a TEXT)`, prepare);

it("generates schema queries", () => {
  expect(sql.schema).toHaveLength(1);
  expect(sql.schema[0].sql).toBe("CREATE TABLE a (a TEXT)");
});

it("executes queries", async () => {
  await sql.schema;
  expect(exec).toHaveBeenCalledTimes(1);
  expect(sql`SELECT * FROM a`.then()).toEqual([{ a: "42" }]);
  expect(exec).toHaveBeenCalledTimes(2);
  expect(await sql`SELECT * FROM a`).toEqual([{ a: "42" }]);
  expect(exec).toHaveBeenCalledTimes(3);

  await sql`SELECT * FROM a WHERE a = ${"1"}`;
  expect(exec).toHaveBeenCalledTimes(4);
  expect(exec).toHaveBeenCalledWith(["1"]);
  expect(prepare).toHaveBeenCalledTimes(3);
  prepare.mockClear();
  exec.mockClear();
});

it("coerces results", async () => {
  const superstruct = { create: JSON.stringify };
  const zod = { parse: JSON.stringify };
  const plain = JSON.stringify;

  const expected = ['{"a":"42"}'];
  expect(await sql`SELECT * FROM a`.as(superstruct)).toEqual(expected);
  expect(await sql`SELECT * FROM a`.as(plain)).toEqual(expected);
  expect(await sql`SELECT * FROM a`.as(zod)).toEqual(expected);
  expect(prepare).toHaveBeenCalledTimes(0);
  expect(exec).toHaveBeenCalledTimes(3);
  prepare.mockClear();
  exec.mockClear();
});

it("interpolates queries", () => {
  const condition = sql`WHERE a=${"1"} OR a=${"2"}`;
  const column = sql.column("a");
  const table = sql.table("a");

  const query = sql`SELECT ${column} FROM ${table} ${condition} OR a=${"42"}`;
  expect(query.sql).toBe('SELECT "a" FROM "a" WHERE a=? OR a=? OR a=?');
  expect(query.params).toEqual(["1", "2", "42"]);
  expect(query.then(JSON.stringify)).toEqual('[{"a":"42"}]');
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(exec).toHaveBeenCalledTimes(1);
  prepare.mockClear();
  exec.mockClear();
});

it("escapes tables", () => {
  expect(sql.table("a").sql).toBe('"a"');
  expect(sql.table('a"' as any).sql).toBe('"a"""');
  expect(sql.table('"a"' as any).sql).toBe('"""a"""');
  expect(sql.table('"a""' as any).sql).toBe('"""a"""""');
});

it("escapes columns", () => {
  expect(sql.column("a").sql).toBe('"a"');
  expect(sql.column('a"' as any).sql).toBe('"a"""');
  expect(sql.column('"a"' as any).sql).toBe('"""a"""');
  expect(sql.column('"a""' as any).sql).toBe('"""a"""""');
});

it("handles array values", () => {
  {
    const values = sql.values([1, 2, 3]);
    expect(values.sql).toBe("VALUES (?,?,?)");
    expect(values.params).toEqual([1, 2, 3]);
  }
  {
    const values = sql.values([1, 2], [3, 4]);
    expect(values.sql).toBe("VALUES (?,?),(?,?)");
    expect(values.params).toEqual([1, 2, 3, 4]);
  }
  {
    const values = sql.values([1], [2], [3], [4]);
    expect(values.sql).toBe("VALUES (?),(?),(?),(?)");
    expect(values.params).toEqual([1, 2, 3, 4]);
  }
});

it("handles object values", () => {
  {
    const values = sql.values({ a: 1, b: 2, c: 3 });
    expect(values.sql).toBe('("a","b","c") VALUES (?,?,?)');
    expect(values.params).toEqual([1, 2, 3]);
  }
  {
    const values = sql.values({ a: 1, b: 2 }, { b: 4, a: 3 });
    expect(values.sql).toBe('("a","b") VALUES (?,?),(?,?)');
    expect(values.params).toEqual([1, 2, 3, 4]);
  }
  {
    const values = sql.values({ a: 1 }, { a: 2 }, { a: 3 });
    expect(values.sql).toBe('("a") VALUES (?),(?),(?)');
    expect(values.params).toEqual([1, 2, 3]);
  }
});

it("throws on zero values", () => {
  expect(() => sql.values()).toThrow("No values were provided!");
});

it("queues prepared statements", async () => {
  const conflict = vi.fn();
  const sql = createSQL<{ a: { a: string } }>(
    `CREATE TABLE a (a TEXT)`,
    async () => {
      let running = false;
      return async () => {
        if (running) conflict();
        running = true;
        await new Promise((r) => setTimeout(r, 100));
        running = false;
        return [];
      };
    }
  );

  const query1 = sql`SELECT * FROM a`;
  const query2 = sql`SELECT * FROM a`;
  await Promise.all([query1, query2]);
  expect(conflict).not.toHaveBeenCalled();
});

it("evicts from statement cache", async () => {
  const CACHE_LIMIT = 10;

  // An isolated instance to run alongside other tests
  const prepare = vi.fn(() => exec);
  const sql = createSQL<{ a: { a: string } }>(``, prepare);

  // We have to put it in a function to ensure that
  //   the `statement` variable is garbage collected
  const fill = (i: number) => {
    const statement = sql(["SELECT " + i]);
    // Simulate 3 uses
    statement.prepare();
    statement.prepare();
    statement.prepare();
  };

  {
    sql`SELECT 42`.prepare(); // Oldest unused statement
    await new Promise((r) => setTimeout(r, 10));
    sql`SELECT 43`.prepare(); // Unused statement
    expect(prepare).toHaveBeenCalledTimes(2);
  }
  // Force cache to fill up
  for (let i = 0; i < CACHE_LIMIT - 1; i++) fill(i);
  expect(prepare).toHaveBeenCalledTimes(11);

  // They should be still in cache, before GC
  {
    sql`SELECT 42`.prepare();
    await new Promise((r) => setTimeout(r, 10));
    sql`SELECT 43`.prepare();
    expect(prepare).toHaveBeenCalledTimes(11);
  }

  // Force garbage collection
  setFlagsFromString("--expose_gc");
  const gc = runInNewContext("gc");
  gc();
  await new Promise((r) => setTimeout(r, 10));

  for (let i = 0; i < CACHE_LIMIT - 1; i++) fill(i); // All these should be in cache
  expect(prepare).toHaveBeenCalledTimes(11);
  sql`SELECT 43`.prepare(); // This should be in cache
  expect(prepare).toHaveBeenCalledTimes(11);
  sql`SELECT 42`.prepare(); // This should have been evicted
  expect(prepare).toHaveBeenCalledTimes(12);
});
