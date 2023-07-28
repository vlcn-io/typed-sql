# typed-sql

Generates types for your SQL.

https://github.com/vlcn-io/typed-sql/assets/1009003/4459edb2-4a52-4641-819d-5805c04d943a

ALPHA release. In theory this covers all of SQLite. In practice, I have written very few tests yet so likely there are many bugs.

Documented issues: https://github.com/vlcn-io/typed-sql/issues

# Installation

Types are generated via a watch task installed with `@vlcn.io/typed-sql-cli`.

```
pnpm install @vlcn.io/typed-sql-cli`
```

See [the cli package](./packages/cli)

# Usage

After installing the cli, see the [runtime component](./packages/typed-sql/README.md) package.

# Current Limitations & Future Work

## Composition

It is possible to do type generation for template strings which are combinations of template strings. E.g.,

```ts
const query = sql`SELECT * FROM ${table} WHERE ${where_clauses}`;
```

Assuming that some type information is available on the parameters to the template tag. E.g., `typeof table = 'foo' | 'bar' | 'baz'`

This is not yet supported.

See [issue 10](https://github.com/vlcn-io/typed-sql/issues/10)

## Custom Types

SQLite lets users declare custom types in their create table statements.

```sql
CREATE TABLE foo (
  id TEXT PRIMARY KEY,
  b MyCustomType,
  c MyOtherCustomType
);
```

We could parse these out and map them to actual typescript types. Doing this would require some runtime layer to convert columns to the correct types.

Python bindings have done this -- https://docs.python.org/3/library/sqlite3.html#sqlite3-converters

See [issue 8](https://github.com/vlcn-io/typed-sql/issues/8)

## Bool

SQLite doesn't return bools! True is `1` and False is `0`. Given this library currently does not handle execution, and only type generation, `bools` are typed as `number`

## Intellisense

I've not implemented a language server yet so intellisense, within the `sql` and `schema` template tags, currently does not exist. It is planned.

[issue 15](https://github.com/vlcn-io/typed-sql/issues/15)

## Syntax Highlighting

Highlighting inside the `sql` and `schema` template tags is not yet supported.

[issue 16](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide)
