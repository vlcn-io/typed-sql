import { createSQL, type ResultOf, type SchemaOf } from "@vlcn.io/typed-sql";
import SQLite, { Database } from "better-sqlite3";

// Cache database connection
let db: Database | undefined;

const sql = createSQL<{
  foo: {
    a: string;
    b: number;
  };
  bar: {
    id: string;
    name: string;
    weight: number;
  };
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

await sql<ZOMG>`INSERT INTO foo VALUES ('1', ${1}), ${sql<ZOMG>`('2', ${"2"})`}`;

const query = sql<ZOMG>`SELECT * FROM foo`;
const result = query.then();
const mapped = query.as(() => 123).then();
console.log(result, mapped);

console.log(await sql`SELECT * FROM foo`.as(JSON.stringify));

type Schema1 = SchemaOf<typeof sql>;
type Schema2 = SchemaOf<typeof query>;
type Result = ResultOf<typeof query>;
