import { createSQL, type ResultOf, type SchemaOf } from "@vlcn.io/typed-sql";

const sql = createSQL<{
  person: {
    id: number,
    name: string | null
  },
  pet: {
    id: number,
    owner_id: number,
    name: string | null
  }
}>(`CREATE TABLE person (id INTEGER PRIMARY KEY NOT NULL, name TEXT);
CREATE TABLE pet (id INTEGER PRIMARY KEY NOT NULL, owner_id INTEGER NOT NULL, name TEXT)`);

const query = sql<[{
  id: number
}]>`SELECT id FROM person`;

// TODO: warn on ambiguous select
const query2 = sql<[{
  id: number,
  name: string | null,
  owner_id: number
}]>`SELECT * FROM person JOIN pet ON pet.owner_id = person.id`;

