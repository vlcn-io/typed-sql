import {LocApp} from './schemas.js';

LocApp.sql<{
  id: number,
  name: string,
  lat: number,
  long: number
}>`SELECT * FROM city`;