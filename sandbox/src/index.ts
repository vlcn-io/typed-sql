import { schema } from "@vlcn.io/typed-sql";

const App = schema<{
  cities: {
    id: number,
    name: string,
    lat: number,
    long: number
  }
}>`CREATE TABLE cities (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, lat FLOAT NOT NULL, long FLOAT NOT NULL);`;

const query = App.sql<{
  id: number
}>`SELECT cities.id FROM cities`