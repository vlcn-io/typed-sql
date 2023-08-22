// type ID_of<T> = any;

// === custom code above this line ===
export type indexType = {
  readonly city: Readonly<{
    id: number;
    name: string;
    lat: number;
    long: number;
  }>;
  readonly place: Readonly<{
    id: number;
    name: string;
    city_id: number;
  }>;
};
