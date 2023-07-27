import { it, expect, vi } from "vitest";
import { createSQL } from "./index.js";

const exec = vi.fn(() => [{ a: "42" }]);
const sql = createSQL<{ a: { a: string } }>(`CREATE TABLE a (a TEXT)`, exec);

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
  expect(exec).toHaveBeenCalledWith("SELECT * FROM a WHERE a = ?", ["1"]);
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
  expect(exec).toHaveBeenCalledTimes(3);
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
  expect(exec).toHaveBeenCalledTimes(1);
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
