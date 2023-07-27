import {
  getDdlRelations,
  getQueryRelations,
  parseQueryRelations,
} from "@vlcn.io/type-gen-ts-adapter";
import { getChildren, normalize, trimTag } from "../util.js";
import ts from "typescript";
import SchemaTypeBuilder from "./SchemaTypeBuilder.js";
import { Fix } from "./types.js";

export default class QueryTypeBuilder {
  constructor(
    private schemaTypeBuilder: SchemaTypeBuilder,
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
    // TODO: if we depend on something not yet visited, get the source file of that thing and spawn a new visitor to visit it!
    // we also need to add a DAG entry for these cases.
    const children = getChildren(node);
    const templateStringNode = children[children.length - 1];
    const schemaAccessNode = children[0];
    const schemaNode = getChildren(schemaAccessNode)[0];
    const schemaRelations =
      this.schemaTypeBuilder.getOrBuildRelationsFromDeclaration(
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
