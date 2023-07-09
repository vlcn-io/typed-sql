import { createSQL, type Schema } from "@vlcn.io/typed-sql";
import SQLite, { Database } from "better-sqlite3";

// Cache database connection
let db: Database | undefined;

const sql = await createSQL<{
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
  async (sql, params) => {
    if (!db) db = new SQLite("tables.db");
    const stmt = db.prepare(sql).bind(...params);
    if (stmt.reader) return stmt.all();
    else stmt.run();
    return [];
  },
  `
CREATE TABLE IF NOT EXISTS foo (a TEXT, b INTEGER);
CREATE TABLE IF NOT EXISTS bar (id TEXT, name TEXT, weight FLOAT);
`
);

type Records = Schema<typeof sql>;

const inner = sql<ZOMG>`('2', ${"2"})`;
await sql<ZOMG>`INSERT INTO foo VALUES ('1', ${1}), ${inner}`;

const result = await sql<ZOMG>`SELECT * FROM foo`;
console.log(result);
