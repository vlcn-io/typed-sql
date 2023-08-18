import {
  parseDdlRelations,
  getDdlRelations,
} from "@vlcn.io/type-gen-ts-adapter";
import { getChildren, normalize, trimTag } from "../util.js";
import ts from "typescript";
import SchemaCache from "../SchemaCache.js";
import { Fix } from "./types.js";
import { Options } from "../Analyzer.js";
import path from "path";

export default class SchemaTypeBuilder {
  constructor(
    private options: Options,
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
      const fix = this.processDeclareSchemaTemplate(this.sourceFile, def);
      for (const f of fix) {
        fixes.push(f);
      }
    }

    return fixes;
  }

  private processDeclareSchemaTemplate(
    file: ts.SourceFile,
    node: ts.TaggedTemplateExpression
  ): Fix[] {
    const children = getChildren(node);
    const templateStringNode = children[children.length - 1];
    const maybeExistingNode = children[1];
    const schemaAccessNode = children[0];
    const range: [number, number] = [
      schemaAccessNode.getEnd(),
      templateStringNode.getStart(),
    ];
    if (ts.isTemplateLiteral(templateStringNode)) {
      let existingGeneric = "";
      if (maybeExistingNode != templateStringNode) {
        existingGeneric = normalize(`<${maybeExistingNode.getText()}>`);
      }
      try {
        const rawSchemaText = trimTag(templateStringNode.getText());
        const schemaRelations = getDdlRelations(rawSchemaText);

        const untaggedReplacement = this.genRecordShapeCode(schemaRelations);
        const normalizedUntaggedReplacement = normalize(untaggedReplacement);

        const ret: Fix[] = [];
        if (this.options.schemaTyping === "inline") {
          this.schemaCache.cache(
            file.fileName,
            normalizedUntaggedReplacement,
            schemaRelations
          );
          const normalizedReplacement = `<${normalizedUntaggedReplacement}>`;
          if (existingGeneric == normalizedReplacement) {
            return [];
          }
          // const pos = this.sourceFile.getLineAndCharacterOfPosition(range[0]);
          ret.push({
            _tag: "InlineFix",
            range,
            replacement: `<${untaggedReplacement}>`,
          });
        } else {
          const typepath = file.fileName.replace(/\.ts$/, "Type.ts");
          this.schemaCache.cache(
            typepath,
            normalizedUntaggedReplacement,
            schemaRelations
          );
          const basename = path.basename(file.fileName, ".ts");
          const typename = basename + "Type";
          ret.push({
            _tag: "CompanionFileFix",
            path: typepath,
            placeAfter: `// === custom code above this line ===\n`,
            content: `export type ${typename} = ${untaggedReplacement};`,
          });
          const newGeneric = `<${typename}>`;
          if (existingGeneric !== newGeneric) {
            ret.push({
              _tag: "InlineFix",
              range,
              replacement: newGeneric,
            });
          }
          const importFrom = `./${typename}.js`;
          if (!file.getFullText().includes(importFrom)) {
            ret.push({
              _tag: "InlineFix",
              range: [0, 0],
              replacement: `import { ${typename} } from "${importFrom}"\n`,
            });
          }
        }

        if (this.options.createSqlFiles) {
          ret.push({
            _tag: "CompanionFileFix",
            path: file.fileName.replace(/\.ts$/, ".sql"),
            content: rawSchemaText,
          });
        }
        return ret;
      } catch (e: any) {
        return [{ _tag: "InlineFix", range, replacement: `<{/*${e}*/}>` }];
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
      return `{
  ${Object.entries(recordTypes)
    .map(([key, value]) => {
      return `readonly ${key.replace("main.", "")}: Readonly<{
    ${Object.entries(value)
      .map(([key, value]) => {
        return `${key}: ${value}`;
      })
      .join(";\n    ")}
  }>`;
    })
    .join(";\n  ")}
}`;
    } catch (e: any) {
      return `{/*
  ${e.message}
*/}` as string;
    }
  }
}
