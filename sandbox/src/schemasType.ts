export type schemasType = {
  readonly user: Readonly<{
    id: number;
    name: string
  }>;
  readonly task: Readonly<{
    id: number;
    what: string;
    owner_id: number;
    list_id: number | null
  }>
};