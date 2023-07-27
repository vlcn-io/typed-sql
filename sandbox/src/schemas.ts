import { schema } from "@vlcn.io/typed-sql";

export const LocApp = schema<{
  city: {
    id: number,
    name: string,
    lat: number,
    long: number
  }
}>`CREATE TABLE city (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  lat FLOAT NOT NULL,
  long FLOAT NOT NULL
);`;
