import { createSQL, type ResultOf, type SchemaOf } from "@vlcn.io/typed-sql";

const sql = createSQL<{
  foo: {
    a: number,
    b: string | null,
    c: bigint
  },
  bar: {
    d: number | null,
    e: number | null
  }
}>(`CREATE TABLE foo (a INTEGER NOT NULL, b TEXT, c BIGINT NOT NULL);
CREATE TABLE bar (d INTEGER, e FLOAT)`);

const query = sql<[{
  d: number | null,
  e: number | null
}]>`SELECT * FROM (SELECT * FROM bar)`