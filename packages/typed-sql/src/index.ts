type Opaque<BaseType, BrandType = unknown> = BaseType & {
  readonly [Symbols.base]: BaseType;
  readonly [Symbols.brand]: BrandType;
};

namespace Symbols {
  export declare const base: unique symbol;
  export declare const brand: unique symbol;
  export declare const internal: unique symbol;
}

type SchemaType<TSchema> = {
  sql<TResult>(strings: TemplateStringsArray, ...values: any[]): Query<TResult>;
  __content: string;
  __type: TSchema;
};

export type Result<P> = P extends Query<infer T> ? T : never;
export type Results<P> = P extends Query<infer T> ? T[] : never;
export type Query<T> = Opaque<string, T>;
export type Record<P> = P extends SchemaType<infer T> ? T : never;
export type Records<P> = P extends SchemaType<infer T> ? T[] : never;
export function schema<TSchema>(
  strings: TemplateStringsArray,
  ...values: any[]
): SchemaType<TSchema> {
  const content = processTemplateStrings(strings, values);
  return {
    sql<T>(strings: TemplateStringsArray, ...values: any[]): Query<T> {
      return processTemplateStrings(strings, values) as Query<T>;
    },
    __content: content,
    __type: null as TSchema,
  };
}

function processTemplateStrings(strings: TemplateStringsArray, values: any[]) {
  let str = "";
  strings.forEach((string, i) => {
    str += string + (values[i] || "");
  });
  return str;
}

/*

const getTasks = MyApp.sql<{

}>`SELECT * FROM task WHERE owner_id = ?`;

CREATE TABLE task (
  id INTEGER PRIMARY KEY NOT NULL,
  what TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  complete BOOLEAN NOT NULL,
  list_id INTEGER
);
*/
