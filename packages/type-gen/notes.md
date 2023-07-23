# type-gen

Two parts:

1. Schema Record Gen
2. Query Result Shape Gen

# Schema Gen

Given DDL statements from the template string passed to `schema`, return an AST representation of the types defined by the DDL.

E.g.,

In:
```sql
CREATE TABLE foo (a INTEGER, b TEXT, c FLOAT);
CREATE TABLE bar (a INTEGER NOT NULL, b TEXT NOT NULL, c FLOAT NOT NULL);
```

Out:
```ts
[
  [foo, [
    [a, integer?],
    [b, text?],
    [c, float?]
  ]],
  [bar, [
    [a, integer],
    [b, text],
    [c, float]
  ]]
]
```

Abstractly:

```ts
[
  [record_name, [
    prop_name,
    prop_type
  ][]][]
]
```

# Query Result Shape Gen

Given a dict of record types:

```ts
{
  [key: record_name]: {
    [key: prop_name]: prop_type
  }
}
```

And a raw SQL string

```sql
SELECT * FROM foo ...;
```

We parse the SQL string, figuring out which columns are selected from which records. We then return a shape that represents the query result, applying aliasing as appropriate.

Harder things:
- window functions
- groups bys
- sub-selects



---
wasm-pack build --target nodejs


cargo build --target wasm32-unknown-unknown
wasm strip?

wasm-opt: https://rustwasm.github.io/docs/book/reference/code-size.html#:~:text=Use%20the%20wasm%2Dopt%20Tool,20%25%20savings%20on%20code%20size.