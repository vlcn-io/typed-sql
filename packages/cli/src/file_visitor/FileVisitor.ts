/**
 * Visits a TypeScript file and:
 * 1. Gathers all Schema definitions
 * 2. Gather all SQL invocations
 * 4. Processes schemas
 * 5. Processes SQL invocations
 *
 * If a SQL invocation refers to a not yet defined schema, this
 * visitor:
 * 1. Finds the file that declares the schema
 * 2. Visits that file
 * 4. Adds the schema definition to the schema cache
 * 5. Returns to this visitor
 *
 * At which point this visitor will add the current
 * files as depending on the other file.
 *
 * This dependency tracking will allow the `analyzer` to
 * analyze all files that depend on another file
 * when that base file changes.
 *
 * Even if the schema has already been defined, we should still set up a dependency
 * between the file containing `sql` statements and all `schema`s it uses.
 *
 * Dependencies on self are ignored.
 */
import SchemaCache from "../SchemaCache.js";

import ts from "typescript";
import SchemaTypeBuilder from "./SchemaTypeBuilder.js";
import DependencyGraph from "../DependencyGraph.js";
import QueryTypeBuilder from "./QueryTypeBuilder.js";
import { Fix } from "./types.js";

/**
 * The file visitor is ephemeral. Created each time we visit a file.
 */
export default class FileVisitor {
  private sqlTemplates: ts.TaggedTemplateExpression[] = [];
  private schemaTemplates: ts.TaggedTemplateExpression[] = [];

  constructor(
    private schemaCache: SchemaCache,
    private dag: DependencyGraph,
    private sourceFile: ts.SourceFile
  ) {}

  visit(checker: ts.TypeChecker) {
    this.dag.orphan(this.sourceFile.fileName);

    this.collectNodes(this.sourceFile, checker);
    const schemaTypeBuilder = new SchemaTypeBuilder(
      this.schemaCache,
      this.dag,
      this.sourceFile
    );
    const schemaFixes = schemaTypeBuilder.buildResidentTypes(
      this.schemaTemplates
    );
    const queryFixes = new QueryTypeBuilder(
      schemaTypeBuilder,
      this.sourceFile
    ).buildQueryTypes(this.sqlTemplates, checker);

    this.applyFixes(schemaFixes.concat(queryFixes));
  }

  applyFixes(fixes: Fix[]) {
    // each fix will shift the locations for all future fixes.
    // so we need to return fixes up the stack.
    // We should also apply all fixes to the in-memory representation of the file then, after all are applied, serialize.
  }

  collectNodes(node: ts.Node, checker: ts.TypeChecker) {
    if (!ts.isTaggedTemplateExpression(node)) {
      ts.forEachChild(node, (node) => this.collectNodes(node, checker));
      return;
    }

    const tagName = node.tag.getText();
    if (tagName.endsWith(".sql")) {
      this.sqlTemplates.push(node);
    } else if (tagName.endsWith("schema")) {
      this.schemaTemplates.push(node);
    }
  }
}
