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

type SchemaType<TSchema> = {
  sql<TResult>(strings: TemplateStringsArray, ...values: any[]): Query<TResult>;
  __content: string;
  __type: TSchema;
};
type RecordTypes<P> = P extends SchemaType<infer T> ? T : never;

function queryType<T>(x: Query<T>): T {
  return null as any;
}

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

// Define Schema can return something with a generated type
// So our file watcher will run on save and generate these schema types.
function defineSchema<TSchema>(schema: { content: string }): SchemaType<TSchema> {
  return {
    sql<T>(strings: TemplateStringsArray, ...values: any[]): Query<T> {
      let str = '';
      strings.forEach((string, i) => {
        str += string + (values[i] || '');
      });
      return str as Query<T>;
    },
    __content: schema.content,
    __type: null as TSchema,
  };
}

function execute<T>(q: Query<T>): T {
  return null as any;
}

const schema = declareSchema<{ User: { id: string; name: string } }>``;
type Records = RecordTypes<typeof schema>;
const q = schema.sql<[{ x: number }]>`SELECT x FROM foo`;
type QResult = ExtractResultType<typeof q>;
const r = execute(q);

type GeneratedType = [
  {
    id: string;
    msg: Msg;
  }
];

// can we do some dope things like register type converters and parse table declarations of custom types?
// and allow imports of typescript types in our schema files...

type TsTypeRef<T> = Opaque<string, T>;
function createSqlTsTypeRef<T>(): TsTypeRef<T> {
  return '' as TsTypeRef<T>;
}

type Msg =
  | {
      _tag: 'do';
      action: string;
    }
  | {
      _tag: 'allocate';
      size: number;
    };
const MsgRef = createSqlTsTypeRef<Msg>();
const AppSchema = defineSchema<{ x: 'y' }>({
  content: `
  CREATE TABLE log (id TEXT PRIMARY KEY, msg ${MsgRef});
  `,
});

const messagesQuery = AppSchema.sql<GeneratedType>`SELECT * FROM log`;
const result = execute(messagesQuery);

result.forEach((r) => {
  switch (r.msg._tag) {
    case 'allocate':
      r.msg._tag;
  }
});
