import { schema } from "@vlcn.io/typed-sql";
import { schemasType } from "./schemasType.js";

export const MyApp = schema<schemasType>`
CREATE TABLE user (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL);
CREATE TABLE task (
  id INTEGER PRIMARY KEY NOT NULL,
  what TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  list_id INTEGER
);
`;
