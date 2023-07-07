# type-gen

Two parts:

1. Schema Record Gen
2. Query Result Shape Gen

# Schema Gen

Given DDL statements from the template string passed to `declareSchema`, return an AST representation of the types defined by the DDL.

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
