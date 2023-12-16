import { createSQL } from "@vlcn.io/typed-db";
import SQLite from "better-sqlite3";

const db = new SQLite("sandbox.db");
const sql = createSQL<{
  foo: {
    a: number;
    b: string | null;
    c: bigint;
  };
  bar: {
    d: number | null;
    e: number | null;
  };
}>(
  `CREATE TABLE IF NOT EXISTS foo (a INTEGER NOT NULL, b TEXT, c BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS bar (d INTEGER, e FLOAT)`,
  (sql) => {
    const prepared = db.prepare(sql);
    return (params: unknown[]) =>
      prepared.reader ? prepared.all(params) : (prepared.run(params), []);
  }
);

await sql.schema;
await sql`DELETE FROM bar`;
await sql`INSERT INTO bar VALUES (1,2),(3,4)`;

const query = sql<{
  d: number | null;
  e: number | null;
}>`SELECT * FROM (SELECT * FROM bar)`;

await query.prepare();
console.log(await query);
