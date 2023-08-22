import { MyApp } from "./schemas.js";

const getUser = MyApp.sql<{
  id: number;
  name: string;
}>`SELECT * FROM user WHERE id = ?;`;

const getTasks = MyApp.sql<{
  /*Could not find the referenced schema relations! Are they defined?*/
}>`SELECT * FROM task WHERE owner_id;`;
