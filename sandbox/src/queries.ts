import { MyApp } from './schemas.js';
 
const getUser = MyApp.sql<{
  id: number,
  name: string
}>`SELECT * FROM user WHERE id = ?`;

const getTasks = MyApp.sql<{
  id: number,
  owner_id: number
}>`SELECT id, owner_id FROM task WHERE owner_id`