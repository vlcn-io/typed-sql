# @vlcn.io/eslint-plugin-typed-sql

An ESLint plugin to generate TypeScript types from SQL statements.

# Usage

1. Add the `@typescript-eslint` and `@vlcn.io/typed-sql` plugins to your `.eslintrc.cjs`
2. Add the `@vlcn.io/typed-sql/codegen`

```js
plugins: ['@typescript-eslint', '@vlcn.io/typed-sql'],
...
rules: {
  '@vlcn.io/typed-sql/codegen': 'error'
}
```

A full example ESLint config:

```js
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  overrides: [
    {files: ["**/*.ts"]},
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: true
  },
  plugins: ['@typescript-eslint', '@vlcn.io/typed-sql'],
  rules: {
    '@vlcn.io/typed-sql/codegen': 'error'
  }
};
```

If you'd like to run this plugin on save with vscode (so types are generated whenever you save a file), add a `.vscode` folder with a `settings.json` file inside.

settings.json:
```json
{
  "editor.codeActionsOnSave": {
      "source.fixAll.eslint": true
  },
  "eslint.validate": [
      "javascript",
      "typescript"
  ],
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

You can look in the [sandbox](../sandbox) package for an example of a complete project setup.

# Why ESLint?

- TypeScript Transformer plugins currently have an uncertain future in terms of official support. They're hacked into the build process via tools like `ttypescript` and `ts-patch`.
  - https://github.com/microsoft/TypeScript/issues/14419
  - https://github.com/microsoft/TypeScript/issues/16607
  - https://github.com/microsoft/TypeScript/issues/54276
- ESLint is officially supported by TypeScript and already has support for plugins that do code-generation via fixers.