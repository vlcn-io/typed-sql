import { get_record_shapes } from 'typed-sql-type-gen';
// init().then(() => {
console.log(get_record_shapes(`
CREATE TABLE foo (
  a INTEGER PRIMARY KEY,
  b TEXT NOT NULL
);
`));
// })

