// schema.sql<ZOMG>`Hey!`;

export type Opaque<BaseType, BrandType = unknown> = BaseType & {
  readonly [Symbols.base]: BaseType;
  readonly [Symbols.brand]: BrandType;
};

namespace Symbols {
  export declare const base: unique symbol;
  export declare const brand: unique symbol;
  export declare const internal: unique symbol;
}

export type Query<T> = Opaque<string, T>;
type ExtractResultType<P> = P extends Query<infer T> ? T : never;
type RecordTypes<P> = P extends SchemaType<infer T> ? T : never;
type SchemaType<TSchema> = {
  sql<TResult>(strings: TemplateStringsArray, ...values: any[]): Query<TResult>;
  __content: string;
  __type: TSchema;
};

function declareSchema<TSchema>(strings: TemplateStringsArray, ...values: any[]): SchemaType<TSchema> {
  let str = '';
  strings.forEach((string, i) => {
    str += string + (values[i] || '');
  });
  return {
    sql<T>(strings: TemplateStringsArray, ...values: any[]): Query<T> {
      let str = '';
      strings.forEach((string, i) => {
        str += string + (values[i] || '');
      });
      return str as Query<T>;
    },
    __content: str,
    __type: null as TSchema,
  };
}

















const schema = declareSchema<{
  foo: {
    a: string,
    b: number
  },
  bar: {
    id: string,
    name: string,
    weight: number
  }
}>`
CREATE TABLE foo (a TEXT, b INTEGER);
CREATE TABLE bar (id TEXT, name TEXT, weight FLOAT);
`;


type Records = RecordTypes<typeof schema>;

// const x = '';
