// This can be used to flatten params of nested queries, but
//  parameter inference cannot be used with generic code-gen:
//  https://github.com/microsoft/TypeScript/issues/26242
// type Flatten<T extends any[]> = T extends [infer U, ...infer R]
//   ? U extends SQL<any, infer TParams, any>
//     ? [...Flatten<U["params"]>, ...Flatten<R>]
//     : [U, ...Flatten<R>]
//   : [];

export const schema = Symbol();
export const result = Symbol();

export type SQL<TSchema, TResult, Async = true> = {
  sql: string;
  params: unknown[]; // We cannot infer those with code-gen...
  [schema]: TSchema;
  [result]: TResult;
} & ([Async] extends [never]
  ? {}
  : {
      as<T>(coercer: Coercer<TResult, T>): SQL<TSchema, T, Async>;
    } & (Async extends true ? PromiseLike<TResult[]> : SyncPromise<TResult[]>));

export type SQLTemplate<TSchema, Async = true> = {
  <TResult>(strings: readonly string[], ...values: unknown[]): SQL<
    TSchema,
    TResult,
    Async
  >;

  schema: SQL<TSchema, void, Async>[] &
    ([Async] extends [never]
      ? {}
      : Async extends true
      ? PromiseLike<void[][]>
      : SyncPromise<void[][]>);
};

export type Coercer<T, U> =
  | ((x: T) => U)
  | { create: (x: T) => U }
  | { parse: (x: T) => U };

export type SchemaOf<P> = P extends { [schema]: infer T }
  ? T
  : P extends SQLTemplate<infer T, any>
  ? T
  : never;

export type ResultOf<P> = P extends { [result]: infer T }
  ? Awaited<T>[]
  : never;

type SyncPromise<T> = {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1) | undefined | null,
    onrejected?: ((reason: any) => TResult2) | undefined | null
  ): TResult1 | TResult2;
};
