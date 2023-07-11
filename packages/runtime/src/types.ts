// This can be used to flatten params of nested queries, but
//  parameter inference cannot be used with generic code-gen:
//  https://github.com/microsoft/TypeScript/issues/26242
// type Flatten<T extends any[]> = T extends [infer U, ...infer R]
//   ? U extends SQL<any, infer TParams, any>
//     ? [...Flatten<U["params"]>, ...Flatten<R>]
//     : [U, ...Flatten<R>]
//   : [];

export const schema = Symbol();

export type SQL<TSchema, TResult, Async = true> = {
  sql: string;
  params: unknown[]; // We cannot infer those with code-gen...
  [schema]: TSchema;
} & ([TResult] extends [never]
  ? {}
  : {
      as<T>(coercer: Coercer<TResult, T>): SQL<TSchema, T, Async>;
    } & Async extends true
  ? PromiseLike<TResult[]>
  : SyncPromise<TResult[]>);

export type Coercer<T, U> =
  | ((x: T) => U)
  | { create: (x: T) => U }
  | { parse: (x: T) => U };

export type SchemaOf<P> = P extends SQL<infer T, any, any>
  ? T
  : P extends (..._: any[]) => SQL<infer T, any, any>
  ? T
  : never;

export type ResultOf<P> = P extends SQL<any, infer T, any>
  ? Awaited<T>[]
  : never;

type SyncPromise<T> = {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1) | undefined | null,
    onrejected?: ((reason: any) => TResult2) | undefined | null
  ): TResult1 | TResult2;
};
