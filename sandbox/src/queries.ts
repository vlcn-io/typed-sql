import { LocApp } from './schemas.js';
 
// wtf
LocApp.sql<{
  id: number,
  name: string,
  lat: number,
  long: number
}>`SELECT * FROM city`;
