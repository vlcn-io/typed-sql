import {
  getDdlRelations,
  getQueryRelations,
  parseQueryRelations,
} from "@vlcn.io/type-gen-ts-adapter";
import { getChildren, normalize, trimTag } from "../util.js";
import ts from "typescript";
import SchemaTypeBuilder from "./SchemaTypeBuilder.js";
import { Fix } from "./types.js";
import DependencyGraph from "../DependencyGraph.js";

export default class QueryTypeBuilder {
  constructor(
    private dag: DependencyGraph,
    private sourceFile: ts.SourceFile
  ) {}

  buildQueryTypes(
    queries: ts.TaggedTemplateExpression[],
    checker: ts.TypeChecker
  ) {
    const fixes = [];
    for (const query of queries) {
      const fix = this.processSqlTemplate(query, checker);
      if (fix != null) {
        fixes.push(fix);
      }
    }

    return fixes;
  }

  private processSqlTemplate(
    node: ts.TaggedTemplateExpression,
    checker: ts.TypeChecker
  ): Fix | null {
    const children = getChildren(node);
    const templateStringNode = children[children.length - 1];
    const schemaAccessNode = children[0];
    const schemaNode = getChildren(schemaAccessNode)[0];
    const schemaRelations = this.lookupRelations(schemaNode, checker);
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
        return null;
      }
      // const pos = this.sourceFile.getLineAndCharacterOfPosition(range[0]);
      return [range, replacement];
    }

    throw new Error(
      `Got an unexpected kind of node: ${templateStringNode.kind}. Was expecting a sql template string.`
    );
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

  /**
   * The ordering in which we process files guarantees that the cache is already warm with
   * schema definitions.
   */
  private lookupRelations(
    schemaNode: ts.Node,
    checker: ts.TypeChecker
  ): ReturnType<typeof getDdlRelations> {
    const schemaNodeSymbol = checker.getSymbolAtLocation(schemaNode);
    const otherDecl = schemaNodeSymbol?.declarations;
    const decl = schemaNodeSymbol?.valueDeclaration;

    if (!decl) {
      if (!otherDecl) {
        return [];
      }
      console.log("fname: ", otherDecl[0].getSourceFile().fileName);
      console.log("start: ", otherDecl[0].getStart());

      return [];
    }

    if (decl.getSourceFile().fileName != this.sourceFile.fileName) {
      this.dag.addDependent(
        decl.getSourceFile().fileName,
        this.sourceFile.fileName
      );
    }

    // query text may not be available to us.
    // we may instead need to rely on the type shape
    // stringified.
    // or cache by `file name`, `start location` of `schema node`?
    return [];
  }
}
