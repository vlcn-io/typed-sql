import { test, expect } from "vitest";
import {
  parseDdlRelations,
  getDdlRelations,
  getQueryRelations,
  NamedRelation,
  parseQueryRelations,
} from "..";

test("queries", () => {
  const schema1 = getDdlRelations(
    `CREATE TABLE foo (a TEXT, b DOUBLE, c BLOB, d INT, e BIGINT);
      CREATE TABLE bar (a INTEGER PRIMARY KEY, b TEXT);
      CREATE TABLE baz (x BIGINT NOT NULL, y TEXT NOT NULL, z BLOB NOT NULL);`
  );
  const cases = [
    [
      "Basic select",
      schema1,
      `SELECT * FROM foo`,
      [
        {
          a: "string | null",
          b: "number | null",
          c: "Uint8Array | null",
          d: "number | null",
          e: "bigint | null",
        },
      ],
    ],
    [
      "Named basic select",
      schema1,
      `SELECT a, e FROM foo`,
      [{ a: "string | null", e: "bigint | null" }],
    ],
    [
      "Select with joins",
      schema1,
      `SELECT foo.a as a, bar.b as b FROM foo JOIN bar`,
      [{ a: "string | null", b: "string | null" }],
    ],
    [
      "literals in selection set",
      schema1,
      `SELECT 1 as f, 'foo' as second;`,
      [{ f: "1", second: "'foo'" }],
    ],
    [
      "select from sub-select",
      schema1,
      `SELECT * FROM (SELECT * FROM baz)`,
      [{ x: "bigint", y: "string", z: "Uint8Array" }],
    ],
    [
      "inner join",
      schema1,
      `SELECT t1.x, t2.y FROM baz as t1, baz as t2`,
      [{ "t1 x": "bigint", "t2 y": "string" }],
      // ^-- todo: qualifiers should not be in the name
    ],
  ] as const;
  runTests(cases);
});

function runTests(
  cases: ReadonlyArray<readonly [string, NamedRelation[], string, any]>
) {
  for (const [description, schema, query, expected] of cases) {
    const shapes = parseQueryRelations(getQueryRelations(query, schema));
    // console.log(shapes);
    expect(shapes).toEqual(expected);
  }
}
