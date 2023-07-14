import {
  get_relation_shapes,
  get_query_result_shapes,
} from "typed-sql-type-gen";

type RelationName = string;
type ColName = string;
type CustomType = string;
type TypeKind = "Literal" | "Builtin" | "Custom" | "Unresolved";
type BuiltinType =
  | "Number"
  | "Boolean"
  | "String"
  | "Blob"
  | "Json"
  | "Int"
  | "Float"
  | "Any"
  | "Null"
  | "Quoted"
  | "BigInt"
  | "Unspecified"
  | "Date"
  | "Time"
  | "CurrentDate"
  | "CurrentTime"
  | "CurrentTimestamp";

type ColType = [TypeKind, BuiltinType | null, CustomType][];
type Col = [ColName, ColType];
export type NamedRelation = [RelationName, Col[]];
type Relation = [RelationName | null, Col[]];

type ParsedRelation = {
  [key: string]: string;
};

export function getDdlRelations(query: string): NamedRelation[] {
  return get_relation_shapes(query) as NamedRelation[];
}

export function parseDdlRelations(rawRelations: NamedRelation[]): {
  [key: string]: ParsedRelation;
} {
  const ret: { [key: string]: ParsedRelation } = {};
  for (const relation of rawRelations) {
    ret[relation[0]] = parseRelation(relation);
  }
  return ret;
}

export function getQueryRelations(
  query: string,
  schema: NamedRelation[]
): Relation[] {
  const rawShapes = get_query_result_shapes(query, schema) as Relation[];
  // TODO: change to structured type
  return rawShapes;
}

export function parseQueryRelations(relations: Relation[]): ParsedRelation[] {
  return relations.map((r) => parseRelation(r));
}

function parseRelation(relation: Relation): ParsedRelation {
  const ret: ParsedRelation = {};
  for (const col of relation[1]) {
    ret[col[0]] = colTypeToTsTypeString(col[1]);
  }
  return ret;
}

function colTypeToTsTypeString(col: ColType): string {
  return col.map((t) => colTypePartToTsType(t)).join(" | ");
}

function colTypePartToTsType([kind, builtin, str]: ColType[number]): string {
  switch (kind) {
    case "Literal": {
      switch (builtin) {
        case "Any":
        case "Blob":
        case "CurrentTimestamp":
        case "Float":
        case "Int":
        case "Number":
        case "Time":
        case "Unspecified":
        case "String":
          return str;
        case "BigInt":
          return str + "n";
        case "Boolean":
          return str.toLowerCase();
        case "CurrentDate":
        case "CurrentTime":
        case "Date":
        case "Json":
        case "Quoted":
          return `'${str}'`;
        case "Null":
          return "null";
      }
    }
    case "Builtin": {
      switch (builtin) {
        case "Any":
          return "any";
        case "BigInt":
          return "bigint";
        case "Blob":
          return "Uint8Array";
        case "Boolean":
          return "boolean";
        case "CurrentDate":
          return "DateStr";
        case "CurrentTime":
          return "TimeStr";
        case "CurrentTimestamp":
          return "Timestamp";
        case "Date":
          return "DateStr";
        case "Float":
          return "number";
        case "Int":
          return "number";
        case "Json":
          // TODO: json_of
          return "JsonStr";
        case "Null":
          return "null";
        case "Number":
          return "number";
        case "Quoted":
          // TODO: quoted_of
          return "QuotedVal";
        case "String":
          return "string";
        case "Time":
          return "TimeStr";
        case "Unspecified":
          return "any";
      }
    }
    case "Custom": {
      return str;
    }
    case "Unresolved": {
      return "unknown";
    }
  }
}
