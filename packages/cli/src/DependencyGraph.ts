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
  private nodes: Map<string, Set<string>> = new Map();

  addDependent(parent: string, child: string) {
    let existing = this.nodes.get(parent);
    if (existing == null) {
      existing = new Set();
      this.nodes.set(parent, existing);
    }
    existing.add(child);
  }

  getDependents(parent: string): Set<string> {
    return this.nodes.get(parent) || new Set();
  }

  orphan(child: string) {
    // remove this child from being dependent on any parent(s)
    // this happens as the first step when we are re-analayzing a file
  }
}
