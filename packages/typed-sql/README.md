# @vlcn.io/typed-sql

The "runtime" component of TypeSQL. This is:

1. A template tag `schema` for defining schemas
2. A set of TS Utility types for working with the generated types

> Note: intellisense and syntax highlighting within template literals has not yet been built.

# Tags

## schema

```ts
const MySchema = schema`
CREATE TABLE ...
CREATE INDEX ...
...
`;
```

The codegen plugin picks up on use of this template to define the types for the schema you're working with. Once you've declared your schema, use the `sql` template literal on that schema to generate types for your `SELECT` statements.

## Schema.sql

```ts
const query = MySchema.sql`SELECT * FROM ...`;
```

The codegen plugin picks up on use of this template to generate types that match the result of your `SELECT` statement.

# Utility Types

## `Record` and `Records` types

```ts
type MySchemaRecord = Record<typeof MySchema>;
type MySchemaRecords = Records<typeof MySchema>;
```

Extracts the generic type of `MySchema` into a top-level type for you to work with.

`Record` refers to a single table row, while `Records` refers to an array of table rows.

E.g.,

```ts
const MySchema = schema<..generated..>`
CREATE TABLE foo (a, b);
CREATE TABLE bar (b, c);
`;

type MySchemaRecords = Records<typeof MySchema>;

function fooProcessor(foos: MySchemaRecords['foo']) {
  ...
}
```

## `Result` and `Results` types

Extracts the generic type of a query into a top-level type for you to work with.

`Result` refers to a single result row, while `Results` refers to an array of result rows.

```ts
const query = MySchema.sql<..generated..>`SELECT a, c FROM foo JOIN bar`;

function execute<T>(query: Query<T>): T {
  return db.execute(query) as T;
}

function someMethod(input: Result<typeof query>) {
  ...
}

const data = execute(query);
someMethod(data);
```
