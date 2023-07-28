import { MyApp } from './schemas.js';
 
const getUser = MyApp.sql<{
  id: number,
  name: string
}>`SELECT * FROM user WHERE id = ?`;

const getTasks = MyApp.sql<{
  id: number,
  what: string,
  owner_id: number,
  list_id: number | null
}>`SELECT * FROM task WHERE owner_id`