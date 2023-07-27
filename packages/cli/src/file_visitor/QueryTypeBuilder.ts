import {
  getDdlRelations,
  getQueryRelations,
  parseQueryRelations,
} from "@vlcn.io/type-gen-ts-adapter";
import { getChildren, trimTag } from "../util.js";
import { normalize } from "path";
import ts from "typescript";
import SchemaTypeBuilder from "./SchemaTypeBuilder.js";

export default class QueryTypeBuilder {
  constructor(
    private schemaTypeBuilder: SchemaTypeBuilder,
    private sourceFile: ts.SourceFile
  ) {}

  buildQueryTypes(
    queries: ts.TaggedTemplateExpression[],
    checker: ts.TypeChecker
  ) {}

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
