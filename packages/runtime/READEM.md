# @vlcn.io/typed-sql

The "runtime" component of TypeSQL. This is:

1. A template tag `declareSchema` for defining schemas
2. A set of TS Utility types for working with the generated types

> Note: intellisense and syntax highlighting within template literals has not yet been built.

# Tags

## declareSchema

```ts
const MySchema = declareSchema`
CREATE TABLE ...
CREATE INDEX ...
...
`
```

The codegen plugin picks up on use of this template to define the types for the schema you're working with. Once you've declared your schema, use the `sql` template literal on that schema to generate types for your `SELECT` statements.

## Schema.sql

```ts
const query = MySchema.sql`SELECT * FROM ...`;
```

The codegen plugin picks up on use of this template to generate types that match the result of your `SELECT` statement.

# Utility Types

## RecordTypes

```ts
type Records = RecordTypes<typeof MySchema>;
```

Extracts the generic type of `MySchema` into a top-level type for you to work with.

E.g.,

```ts
const MySchema = declareSchema<..generated..>`
CREATE TABLE foo (a, b);
CREATE TABLE bar (b, c);
`;

type Records = RecordTypes<typeof MySchema>;

function fooProcessor(foos: Records['foo'][]) {
  ...
}
```

## ResultType

Extracts the generic type of a query into a top-level type for you to work with.

```ts
const query = MySchema.sql<..generated..>`SELECT a, c FROM foo JOIN bar`;

function execute<T>(query: Query<T>): T {
  return db.execute(query) as T;
}

function someMethod(input: ResultType<typeof query>) {
  ...
}

const data = execute(query);
someMethod(data);
```

