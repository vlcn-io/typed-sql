import { schema } from "@vlcn.io/typed-sql";

export const MyApp = schema<{
  user: {
    id: number,
    name: string
  },
  task: {
    id: number,
    what: string,
    owner_id: number,
    list_id: number | null
  }
}>`
CREATE TABLE user (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL);
CREATE TABLE task (
  id INTEGER PRIMARY KEY NOT NULL,
  what TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  list_id INTEGER
)
`;
