import { get_relation_shapes, get_query_result_shapes } from "typed-sql-type-gen";

type RelationName = string;
type ColName = string;
type CustomType = string;
type TypeKind = 'Literal' | 'Builtin' | 'Custom' | 'Unresolved';
type BuiltinType = 'Number' |
  'Boolean' |
  'String' |
  'Blob' |
  'Json' |
  'Int' |
  'Float' |
  'Any' |
  'Null' |
  'Quoted' |
  'BigInt' |
  'Unspecified' |
  'Date' |
  'Time' |
  'CurrentDate' |
  'CurrentTime' |
  'CurrentTimestamp';

type ColType = [TypeKind, BuiltinType | null, CustomType][];
type Col = [ColName, ColType];
type NamedRelation = [RelationName, Col[]];
type Relation = [RelationName | null, Col[]];

type ParsedRelation = {
  [key: string]: ColType
};

export function relationShapes(query: string): {[key:string]: ParsedRelation} {
  const rawRelations = get_relation_shapes(query) as NamedRelation[];
  const ret: {[key:string]: ParsedRelation} = {};
  for (const relation of rawRelations) {
    ret[relation[0]] = parseRelation(relation);
  }
  return ret;
}

export function queryShapes() {}

function parseRelation(relation: Relation): ParsedRelation {
  const ret: ParsedRelation = {};
  for (const col of relation[1]) {
    ret[col[0]] = col[1];
  }
  return ret;
}