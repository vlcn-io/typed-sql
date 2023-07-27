import { schema } from "@vlcn.io/typed-sql";

export const LocApp = schema<{
  city: {
    id: number,
    name: string
  }
}>`CREATE TABLE city (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL
);`;


