import {
  parseDdlRelations,
  getDdlRelations,
  getQueryRelations,
  parseQueryRelations,
} from "@vlcn.io/type-gen-ts-adapter";
import { getChildren, normalize, trimTag } from "../util.js";
import ts from "typescript";
import SchemaCache from "../SchemaCache.js";
import DependencyGraph from "../DependencyGraph.js";
import { Fix } from "./types.js";

export default class SchemaTypeBuilder {
  constructor(
    private schemaCache: SchemaCache,
    private sourceFile: ts.SourceFile
  ) {}

  /**
   * Builds all of the types for the schemas that are resident to the current
   * file.
   *
   * This clears the schema type cache for that file and re-builds it for that file.
   *
   * Will reun the replace against the file.
   */
  buildResidentTypes(schemaDefinitions: ts.TaggedTemplateExpression[]) {
    this.schemaCache.clearForFile(this.sourceFile.fileName);
    const fixes = [];

    // process templates
    for (const def of schemaDefinitions) {
      const maybeFix = this.processDeclareSchemaTemplate(this.sourceFile, def);
      if (maybeFix) {
        fixes.push(maybeFix);
      }
    }

    return fixes;
  }

  private processDeclareSchemaTemplate(
    file: ts.SourceFile,
    node: ts.TaggedTemplateExpression
  ): Fix | null {
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
      try {
        const schemaRelations = getDdlRelations(
          trimTag(templateStringNode.getText())
        );

        this.schemaCache.cache(
          file.fileName,
          schemaAccessNode.getEnd() + 1,
          schemaRelations
        );

        const replacement = this.genRecordShapeCode(schemaRelations);
        if (existingContent == normalize(replacement)) {
          return null;
        }
        // const pos = this.sourceFile.getLineAndCharacterOfPosition(range[0]);
        return [range, replacement];
      } catch (e: any) {
        return [range, `<{/*${e}*/}>`];
      }
    }

    throw new Error(
      `Unexpected AST node kind: ${templateStringNode.kind}. This should have been a template literal defining a schema.`
    );
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
}
