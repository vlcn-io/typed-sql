import { createSQL, type ResultOf, type SchemaOf } from "@vlcn.io/typed-sql";
import SQLite, { Database } from "better-sqlite3";

// Cache database connection
let db: Database | undefined;
type ZOMG = any;

const sql = createSQL<{
  foo: {
      a: string | null,
b: number | null
    },
bar: {
      id: string | null,
name: string | null,
weight: number | null
    }
}>(
  `
  CREATE TABLE IF NOT EXISTS foo (a TEXT, b INTEGER);
  CREATE TABLE IF NOT EXISTS bar (id TEXT, name TEXT, weight FLOAT);
  `,
  (sql, params) => {
    if (!db) db = new SQLite("tables.db");
    const stmt = db.prepare(sql).bind(...params);
    if (stmt.reader) return stmt.all();
    else stmt.run();
    return [];
  }
);

await sql.schema;
await sql<ZOMG>`INSERT INTO ${sql.table("foo")} ${sql.values(["1", 1])}`;

const query = sql<ZOMG>`SELECT * FROM foo`;
const result = query.then();
const mapped = query.as(() => 123).then();
console.log(result, mapped);

console.log(await sql`SELECT * FROM foo`.as(JSON.stringify));

type Schema1 = SchemaOf<typeof sql>;
type Schema2 = SchemaOf<typeof query>;
type Result = ResultOf<typeof query>;
