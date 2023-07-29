export function queue<T>(resource: T): Queued<T> {
  const tasks: Set<Promise<any>> = new Set();
  return <R>(task: (resource: T) => R | Promise<R>) => {
    const current = tasks.size
      ? Promise.all(tasks).then(() => task(resource))
      : task(resource);
    if (!isPromise(current)) return current;
    tasks.add(current);
    return current.then((x) => (tasks.delete(current), x));
  };
}

export function isPromise(value: any): value is PromiseLike<unknown> {
  return value && typeof value === "object" && typeof value.then === "function";
}

export type Queued<T> = {
  <R = void>(task: (resource: T) => Promise<R>): Promise<R>;
  <R = void>(task: (resource: T) => R): R;
};
