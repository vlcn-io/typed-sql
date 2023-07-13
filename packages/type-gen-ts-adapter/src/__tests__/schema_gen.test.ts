import { test, expect } from "vitest";
import { relationShapes } from "..";

test("generates types for table schemas", () => {
  const cases = [
    ['Empty schema', ``, []],
    ['Single table', `CREATE TABLE foo (a);`, []]
  ] as const;

  runTests(cases);
});

function runTests(cases: ReadonlyArray<readonly [string, string, any]>) {
  for (const [description, query, expected] of cases) {
    const shape = relationShapes(query);
    console.log(shape);
    // expect(shape).toEqual(expected);
  }
}