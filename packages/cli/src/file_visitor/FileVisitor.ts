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
import { CompanionFileFix, Fix } from "./types.js";
import { normalize, replaceRange } from "../util.js";
import fs from "fs";
import { Options } from "../Analyzer.js";

/**
 * The file visitor is ephemeral. Created each time we visit a file.
 */
export default class FileVisitor {
  private sqlTemplates: ts.TaggedTemplateExpression[] = [];
  private schemaTemplates: ts.TaggedTemplateExpression[] = [];

  constructor(
    private options: Options,
    private schemaCache: SchemaCache,
    private dag: DependencyGraph,
    private sourceFile: ts.SourceFile
  ) {}

  visitAll(checker: ts.TypeChecker) {
    this.dag.orphan(this.sourceFile.fileName);

    this.collectAllNodes(this.sourceFile, checker);
    const schemaTypeBuilder = new SchemaTypeBuilder(
      this.options,
      this.schemaCache,
      this.sourceFile
    );
    const schemaFixes = schemaTypeBuilder.buildResidentTypes(
      this.schemaTemplates
    );
    const queryFixes = new QueryTypeBuilder(
      this.schemaCache,
      this.dag,
      this.sourceFile
    ).buildQueryTypes(this.sqlTemplates, checker);

    this.applyFixes(schemaFixes.concat(queryFixes));
  }

  visitSchemaDefs(checker: ts.TypeChecker) {
    this.collectSchemaNodes(this.sourceFile, checker);
    const schemaFixes = new SchemaTypeBuilder(
      this.options,
      this.schemaCache,
      this.sourceFile
    ).buildResidentTypes(this.schemaTemplates);

    this.applyFixes(schemaFixes);
  }

  visitQueryDefs(checker: ts.TypeChecker) {
    this.collectQueryNodes(this.sourceFile, checker);
    const queryFixes = new QueryTypeBuilder(
      this.schemaCache,
      this.dag,
      this.sourceFile
    ).buildQueryTypes(this.sqlTemplates, checker);

    this.applyFixes(queryFixes);
  }

  applyFixes(fixes: Fix[]) {
    if (fixes.length == 0) {
      return;
    }
    let offset = 0;
    for (const fix of fixes) {
      switch (fix._tag) {
        case "InlineFix": {
          const { range, replacement } = fix;
          const text = this.sourceFile.getFullText();
          const updatedText = replaceRange(
            text,
            range[0],
            range[1],
            replacement
          );

          // if replacement is _longer_ than what was replaced then all other replacements shift further away
          // if replacement is _shorter_ then they shift closer
          offset += replacement.length - (range[1] - range[0]);
          fs.writeFileSync(this.sourceFile.fileName, updatedText);
          break;
        }
        case "CompanionFileFix": {
          // write the companion file
          this.#writeCompanionFile(fix);
        }
      }
    }
  }

  // only write it if it differs from what is on disk after normalization
  #writeCompanionFile(fix: CompanionFileFix) {
    let prefix = fix.placeAfter ?? "";
    if (fs.existsSync(fix.path)) {
      let existing = fs.readFileSync(fix.path, "utf-8");
      let placeAfterEnd = 0;
      if (fix.placeAfter != null) {
        const placeAfterStart = existing.indexOf(fix.placeAfter);
        if (placeAfterStart != -1) {
          placeAfterEnd = placeAfterStart + fix.placeAfter.length;
          prefix = existing.substring(0, placeAfterEnd);
          existing = existing.substring(placeAfterEnd);
        }
      }
      if (normalize(existing) == normalize(fix.content)) {
        console.log(`No difference for companion file ${fix.path}`);
        return;
      }
    }
    fs.writeFileSync(fix.path, prefix + fix.content);
  }

  collectAllNodes(node: ts.Node, checker: ts.TypeChecker) {
    if (!ts.isTaggedTemplateExpression(node)) {
      ts.forEachChild(node, (node) => this.collectAllNodes(node, checker));
      return;
    }

    const tagName = node.tag.getText();
    if (tagName.endsWith(".sql")) {
      this.sqlTemplates.push(node);
    } else if (tagName.endsWith("schema")) {
      this.schemaTemplates.push(node);
    }
  }

  collectSchemaNodes(node: ts.Node, checker: ts.TypeChecker) {
    if (!ts.isTaggedTemplateExpression(node)) {
      ts.forEachChild(node, (node) => this.collectSchemaNodes(node, checker));
      return;
    }

    const tagName = node.tag.getText();
    if (tagName.endsWith("schema")) {
      this.schemaTemplates.push(node);
    }
  }

  collectQueryNodes(node: ts.Node, checker: ts.TypeChecker) {
    if (!ts.isTaggedTemplateExpression(node)) {
      ts.forEachChild(node, (node) => this.collectQueryNodes(node, checker));
      return;
    }

    const tagName = node.tag.getText();
    if (tagName.endsWith(".sql")) {
      this.sqlTemplates.push(node);
    }
  }
}
