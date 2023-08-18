export type indexType = {
  readonly city: Readonly<{
    id: ID_of<indexType["city"]>;
    name: string;
    lat: number
  }>
};