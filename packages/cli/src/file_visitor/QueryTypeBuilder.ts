import {
  getDdlRelations,
  getQueryRelations,
  parseQueryRelations,
} from "@vlcn.io/type-gen-ts-adapter";
import { getChildren, normalize, trimTag } from "../util.js";
import ts from "typescript";
import { Fix } from "./types.js";
import DependencyGraph from "../DependencyGraph.js";
import SchemaCache from "../SchemaCache.js";

export default class QueryTypeBuilder {
  constructor(
    private schemaCache: SchemaCache,
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
    // range of text to replace. Inclusive of `<` and `>` if they exist.
    const range: [number, number] = [
      schemaAccessNode.getEnd(),
      templateStringNode.getStart(),
    ];
    const maybeExistingNode = children[1];
    if (ts.isTemplateLiteral(templateStringNode)) {
      try {
        const schemaRelations = this.lookupRelations(schemaNode, checker);
        if (schemaRelations == null) {
          return null;
        }
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
        return { _tag: "InlineFix", range, replacement };
      } catch (e: any) {
        return {
          _tag: "InlineFix",
          range,
          replacement: `<{/*${e.message}*/}>`,
        };
      }
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
    .join(";\n  ")}
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
  ): ReturnType<typeof getDdlRelations> | null {
    // const schemaNodeSymbol = checker.getSymbolAtLocation(schemaNode);
    const type = checker.getTypeAtLocation(schemaNode);
    const prop = type.getProperty("__type");
    // must not be _our_ sql literal but someone else's
    if (prop == null) {
      return null;
    }
    const internalType = checker.getTypeOfSymbol(prop);
    // console.log(internalType.getSymbol()?.declarations);
    const internalProps = checker.getPropertiesOfType(internalType);

    const decl = internalType.getSymbol()?.declarations?.[0];

    if (!decl) {
      const loc = this.sourceFile.getLineAndCharacterOfPosition(
        schemaNode.getStart()
      );
      throw new Error(
        `Could not find the referenced schema typescript type! Is it defined? ${this.sourceFile.fileName}:${loc.line}:${loc.character}`
      );
    }

    // console.log(
    //   "source? ",
    //   decl.getSourceFile().fileName,
    //   decl.getStart(),
    //   decl.getText()
    // );

    if (decl.getSourceFile().fileName != this.sourceFile.fileName) {
      this.dag.addDependent(
        decl.getSourceFile().fileName,
        this.sourceFile.fileName
      );
    }

    const ret = this.schemaCache.get(
      decl.getSourceFile().fileName,
      decl.getStart()
    );
    if (!ret) {
      const loc = this.sourceFile.getLineAndCharacterOfPosition(
        schemaNode.getStart()
      );

      throw new Error(
        `Could not find the referenced schema relations! Are they defined? ${this.sourceFile.fileName}:${loc.line}:${loc.character}}`
      );
    }

    return ret;
  }
}

/**
 * Cache relation by
 * type_structure -> relation
 *
 * Still blow away on processing file that defines the type structures.
 *
 * Map dag by:
 * file -> type_structures -> dependent files
 */
