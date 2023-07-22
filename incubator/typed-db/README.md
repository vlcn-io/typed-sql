Exploration of pairing SQL execution w/ type generation.

# Why do this?

SQLite lets you declare custom types on your `CREATE TABLE` statements. This means we could refer to TypeScript types from SQL. E.g., the Python bindings for SQLite already support this.

When reading values out of the DB, however, we need to coerce to the typescript types. Some execution layer needs to do that or wrapper over an execution layer.

# Why not do this?

The state of SQLite bindings in JavaScript is a mess and everyone does it differently. So it is likely best to start by only providing type generation (to augment the user's choice of bindings) and later adding on execution.

1. The `ghsot` sqlite bindings are really bad and inefficient.
2. The `better-sqlite` bindings are good but treat bigints poorly
3. Some bindings are async
4. Some are synchronous
5. In the browser there are 5+ sets. wa-sqlite, official sqlite, official sqlite oo1, official sqlite promiser, official sqlite bundled and wrapped by a Google dev rel person, absurd-sql, etc. etc.