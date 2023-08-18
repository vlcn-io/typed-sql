import { indexType } from "./indexType.js"
import { schema } from "@vlcn.io/typed-sql";

const App = schema<indexType>`
CREATE TABLE city (
  id 'ID_of<indexType["city"]>' PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  lat FLOAT NOT NULL,
  long FLOAT NOT NULL
);`;

// CREATE TABLE place (
//   id INTEGER PRIMARY KEY NOT NULL,
//   name TEXT NOT NULL,
//   city_id INTEGER NOT NULL
// )

// const query = App.sql<{
//   city_id: 'ID_of<indexType["city"]>';
//   place_name: string
// }>`SELECT city.id as city_id, place.name as place_name 
//   FROM city JOIN place`;
