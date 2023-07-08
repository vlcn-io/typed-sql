import {declareSchema, RecordTypes} from "@vlcn.io/typed-sql";

const schema = declareSchema<{
  foo: {
    a: string,
    b: number
  },
  bar: {
    id: string,
    name: string,
    weight: number
  }
}>`
CREATE TABLE foo (a TEXT, b INTEGER);
CREATE TABLE bar (id TEXT, name TEXT, weight FLOAT);
`;


type Records = RecordTypes<typeof schema>;

// const x = '';
// schema.sql<ZOMG>`Hey!`;