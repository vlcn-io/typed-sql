import { schema } from "@vlcn.io/typed-sql";

const App = schema<{
  cities: {
    id: number,
    name: string,
    lat: number,
    long: number
  }
}>`
CREATE TABLE cities (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  lat FLOAT NOT NULL,
  long FLOAT NOT NULL
);
`;

const query = App.sql<{
  id: number,
  name: string,
  lat: number
}>`SELECT id, name, lat FROM cities`


App.sql<{
  id: number,
  name: string,
  lat: number,
  long: number
}>`SELECT * FROM cities WHERE lat > 0 AND long < 0`;

sql<{
  id: number,
  name: string,
  lat: number,
  long: number
}>`SELECT * FROM cities WHERE lat > 0 AND long < 0`;


function sql<T>(s: TemplateStringsArray, ...args: any) {

}