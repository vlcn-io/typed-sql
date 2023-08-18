type ID_of<T> = any;

// === custom code above this line ===
export type indexType = {
  readonly city: Readonly<{
    id: ID_of<indexType["city"]>;
    name: string;
    lat: number;
    long: number
  }>
};