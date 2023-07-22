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
