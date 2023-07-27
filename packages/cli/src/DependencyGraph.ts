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
 */

export default class DependencyGraph {}
