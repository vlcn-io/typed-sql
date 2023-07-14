import { test, expect } from "vitest";
import { parseDdlRelations, getDdlRelations } from "..";

test("generates types for table schemas", () => {
  const cases = [
    ["Empty schema", ``, {}],
    [
      "Unspecified Nullable",
      `CREATE TABLE foo (a);`,
      { "main.foo": { a: "any | null" } },
    ],
    [
      "Unspecified not null",
      `CREATE TABLE foo (a NOT NULL);`,
      { "main.foo": { a: "any" } },
    ],
    [
      "Int not null",
      `CREATE TABLE foo (a INT NOT NULL)`,
      { "main.foo": { a: "number" } },
    ],
    [
      "text, float, blob, int, bigint",
      `CREATE TABLE foo (a TEXT, b DOUBLE, c BLOB, d INT, e BIGINT);
      CREATE INDEX foo_a ON foo (a);
      INSERT INTO foo VALUES (1,2,3);`, // non create table statements should be ignored
      {
        "main.foo": {
          a: "string | null",
          b: "number | null",
          c: "Uint8Array | null",
          d: "number | null",
          e: "bigint | null",
        },
      },
    ],
  ] as const;

  runTests(cases);
});

function runTests(cases: ReadonlyArray<readonly [string, string, any]>) {
  for (const [description, query, expected] of cases) {
    const shape = parseDdlRelations(getDdlRelations(query));
    expect(shape).toEqual(expected);
  }
}
