import { it, expect, vi } from "vitest";
import { queue } from "./queue.js";

it("executes tasks sequentially", async () => {
  const q = queue({ val: 0 });
  const add = (n: number) => (resource: { val: number }) => (resource.val += n);
  const result = await Promise.all([q(add(1)), q(add(2)), q(add(3))]);
  expect(result).toEqual([1, 3, 6]);
});

it("handles race conditions", async () => {
  const q = queue({ val: 0 });
  const add = (n: number, delay: number) => (resource: { val: number }) =>
    new Promise<number>((resolve) =>
      setTimeout(() => resolve((resource.val += n)), delay)
    );
  const result = await Promise.all([q(add(1, 10)), q(add(2, 0))]);
  expect(result).toEqual([1, 3]);
});

it("supports sync & async execution", async () => {
  const q = queue(0);
  const asyncFunction = vi.fn(async () => 42);
  const syncFunction = vi.fn(() => 42);
  expect(q(syncFunction)).toBe(42);
  expect(syncFunction).toHaveBeenCalled();
  expect(q(asyncFunction)).resolves.toBe(42);
  expect(asyncFunction).toHaveBeenCalled();
});
