# VS Code extension: SQL tagged template literals

A VS Code extension, which enables SQL syntax highlighting for template literals tagged with an `sql`, `sqlFrag` or `schema` function in JavaScript and TypeScript files.

![Image of code snippet showing SQL syntax highlighting](../docs/preview.png)

Supported are:

- Tagged template literals:

  ```ts
  sql`SELECT * FROM user`;
  sqlFrag`WHERE id = ${id}`;
  ```

- And combinations with TypeScript features. Some examples:

  ```ts
  sql<With, Generic<Types>>`SELECT * FROM user`;
  nested?.optional?.sql`SELECT * FROM user`;
  ```

## Thanks

Derived from

https://github.com/frigus02/vscode-sql-tagged-template-literals | https://github.com/frigus02/vscode-sql-tagged-template-literals/pull/28