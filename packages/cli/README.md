# cli

Install -

```sh
npm install @vlcn.io/typed-sql-cli
```

Add to `package.json`

```json
"scripts": {
  "sql-watch": "typed-sql -p ."
},
```

Run:

```sh
npm run sql-watch
```

Args:

required: `-p path/to/project`
optional: `-t name_of_tsconfig.json` defaults to tsconfig.json

---

A different route.

The current path uses an ESLint plugin to inject generated types on save.

- Setting up ESLint is too many steps and problematic for people who don't use ESLint
- ESLint doesn't buy us much given our rules can impact _other_ files, not just the file being edited. E.g., when a schema is change all query shapes using that schema may need updating.
- We need a persistent process to retain the state of schemas so we can use that state as we encounter future queries

The cli is the new approach to do all of this and drop ESLint.
