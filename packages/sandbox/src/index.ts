import { declareSchema } from "@vlcn.io/typed-sql";

const App = declareSchema<{
  foo: {
    a: number,
    b: string | null,
    c: bigint
  },
  bar: {
    d: number | null,
    e: number | null
  }
}>`CREATE TABLE foo (a INTEGER NOT NULL, b TEXT, c BIGINT NOT NULL);
CREATE TABLE bar (d INTEGER, e FLOAT)`;

const query = App.sql<[{
  a: number,
  b: string | null,
  c: bigint
}]>`SELECT * FROM foo`