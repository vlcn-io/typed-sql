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
import {
  parseDdlRelations,
  getDdlRelations,
  getQueryRelations,
  parseQueryRelations,
} from "@vlcn.io/type-gen-ts-adapter";
import { getChildren, trimTag } from "../util.js";
import { normalize } from "path";
import SchemaCache from "../SchemaCache.js";

import ts from "typescript";
import SchemaTypeBuilder from "./SchemaTypeBuilder.js";
import DependencyGraph from "../DependencyGraph.js";

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
    this.collectNodes(this.sourceFile, checker);

    this.dag.orphan(this.sourceFile.fileName);
    const schemaTypeBuilder = new SchemaTypeBuilder(
      this.schemaCache,
      this.dag,
      this.sourceFile
    ).buildResidentTypes(this.schemaTemplates);
    for (const sql of this.sqlTemplates) {
      this.processSqlTemplate(sql, checker);
    }
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

  private processDeclareSchemaTemplate(
    node: ts.TaggedTemplateExpression,
    checker: ts.TypeChecker
  ): ReturnType<typeof getDdlRelations> {
    const children = getChildren(node);
    const templateStringNode = children[children.length - 1];
    const maybeExistingNode = children[1];
    const schemaAccessNode = children[0];
    const range: [number, number] = [
      schemaAccessNode.getEnd(),
      templateStringNode.getStart(),
    ];
    if (ts.isTemplateLiteral(templateStringNode)) {
      let existingContent = "";
      if (maybeExistingNode != templateStringNode) {
        existingContent = normalize(`<${maybeExistingNode.getText()}>`);
      }
      const schemaRelations = getDdlRelations(
        trimTag(templateStringNode.getText())
      );
      // this.schemaCache.put();
      const replacement = this.genRecordShapeCode(schemaRelations);
      if (existingContent == normalize(replacement)) {
        return schemaRelations;
      }
      const pos = this.sourceFile.getLineAndCharacterOfPosition(range[0]);
      // TODO: replace!
      // context.report({
      //   message: `content does not match: ${replacement}`,
      //   loc: { line: pos.line, column: pos.character },
      //   fix: (fixer) => fixer.replaceTextRange(range, replacement),
      // });

      return schemaRelations;
    }

    return [];
  }

  private processSqlTemplate(
    node: ts.TaggedTemplateExpression,
    checker: ts.TypeChecker
  ) {
    // TODO: if we depend on something not yet visited, get the source file of that thing and spawn a new visitor to visit it!
    // we also need to add a DAG entry for these cases.
    const children = getChildren(node);
    const templateStringNode = children[children.length - 1];
    const schemaAccessNode = children[0];
    const schemaNode = getChildren(schemaAccessNode)[0];
    const schemaRelations = this.getSchemaRelationsForQueryDependency(
      schemaNode,
      checker
    );
    // range of text to replace. Inclusive of `<` and `>` if they exist.
    const range: [number, number] = [
      schemaAccessNode.getEnd(),
      templateStringNode.getStart(),
    ];
    const maybeExistingNode = children[1];
    if (ts.isTemplateLiteral(templateStringNode)) {
      // process it, extracting type information
      let existingContent = "";
      if (maybeExistingNode != templateStringNode) {
        existingContent = normalize(`<${maybeExistingNode.getText()}>`);
      }
      const replacement = this.genQueryShape(
        templateStringNode.getText(),
        schemaRelations
      );
      if (existingContent == normalize(replacement)) {
        return;
      }
      const pos = this.sourceFile.getLineAndCharacterOfPosition(range[0]);
      // TODO: replace!
      // context.report({
      //   message: `content does not match: ${replacement}`,
      //   loc: { line: pos.line, column: pos.character },
      //   fix: (fixer) => fixer.replaceTextRange(range, replacement),
      // });
    }
  }

  private getSchemaRelationsForQueryDependency(
    schemaNode: ts.Node,
    checker: ts.TypeChecker
  ): ReturnType<typeof getDdlRelations> {
    const schemaNodeSymbol = checker.getSymbolAtLocation(schemaNode);
    const decl = schemaNodeSymbol?.valueDeclaration;
    // this is the correct source file containing schema!
    console.log(decl!.getSourceFile().fileName);
    console.log(decl?.getFullText());

    // if the file has already been visited then we'll already have the required relations.
    // what is the cache key for those relations though???
    // fileName + declaration site?

    // if the file has not been visited we must eagerly visit it from this visitor.

    return [];
  }

  // TODO: take in original indentation offset
  private genRecordShapeCode(
    relations: ReturnType<typeof getDdlRelations>
  ): string {
    try {
      const recordTypes = parseDdlRelations(relations);
      return `<{
  ${Object.entries(recordTypes)
    .map(([key, value]) => {
      return `${key.replace("main.", "")}: {
    ${Object.entries(value)
      .map(([key, value]) => {
        return `${key}: ${value}`;
      })
      .join(",\n    ")}
  }`;
    })
    .join(",\n  ")}
}>`;
    } catch (e: any) {
      return `<{/*
  ${e.message}
*/}>` as string;
    }
  }

  private eagerlyProcessSchema(
    checker: ts.TypeChecker,
    schemaType: ts.Symbol
  ): ReturnType<typeof getDdlRelations> {
    const decls = schemaType.getDeclarations() || [];
    for (const decl of decls) {
      const sourceFile = decl.getSourceFile();
      const fileName = sourceFile.fileName;
      console.log(fileName);
    }

    return [];
  }

  private genQueryShape(
    query: string,
    schemaRelations: ReturnType<typeof getDdlRelations>
  ) {
    query = trimTag(query);

    // TODO: they could have passed many queries...
    try {
      const shape = parseQueryRelations(
        getQueryRelations(query, schemaRelations)
      )[0];
      // const type = checker.getTypeOfSymbol(schemaType);
      // const props = type.getProperties();
      // top level props are records.
      // prop name is record name
      // prop type is record type
      // pack all these into dicts to pass over to type generator
      // need to convert schemaType back to raw relation type(s)

      // TODO: indent by original file indentation of surrounding context
      if (shape == null) {
        return `<unknown>`;
      } else {
        return `<{
  ${Object.entries(shape)
    .map(([key, value]) => {
      return `${key}: ${value}`;
    })
    .join(",\n  ")}
}>`;
      }
    } catch (e: any) {
      return `<{/*
  ${e.message}
*/}>`;
    }
  }
}
