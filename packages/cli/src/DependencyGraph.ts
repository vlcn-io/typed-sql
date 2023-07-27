/**
 * We only track dependencies at a file level.
 *
 * E.g., which file depends on which.
 *
 * Within a file we:
 * - process schemas
 * - then process sql statements
 *
 * which removes the need to do in-file dependency tracking.
 *
 * When analyzing a file we need to remove it as a dependent on anything and re-build the dependent markers for that file.
 */

export default class DependencyGraph {
  private parentToChild: Map<string, Set<string>> = new Map();
  private childToParent: Map<string, Set<string>> = new Map();

  addDependent(parent: string, child: string) {
    let existing = this.parentToChild.get(parent);
    if (existing == null) {
      existing = new Set();
      this.parentToChild.set(parent, existing);
    }
    existing.add(child);

    existing = this.childToParent.get(child);
    if (existing == null) {
      existing = new Set();
      this.childToParent.set(child, existing);
    }
    existing.add(parent);
  }

  getDependents(parent: string): Set<string> {
    return this.parentToChild.get(parent) || new Set();
  }

  orphan(child: string) {
    // remove this child from being dependent on any parent(s)
    // this happens as the first step when we are re-analayzing a file
    const parents = this.childToParent.get(child);
    if (parents == null) {
      return;
    }

    for (const parent of parents) {
      const children = this.parentToChild.get(parent);
      if (children == null) {
        throw new Error("Parent-child, child-parent map are inconsistent!");
      }
      if (!children.delete(child)) {
        throw new Error("Parent-child and child-parent sets are inconsistent!");
      }
      if (children.size == 0) {
        this.parentToChild.delete(parent);
      }
    }

    // we've de-parented. No more parents.
    this.childToParent.delete(child);
  }
}
