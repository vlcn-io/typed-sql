import ts from "typescript";
import {
  parseDdlRelations,
  getDdlRelations,
  getQueryRelations,
  parseQueryRelations,
} from "@vlcn.io/type-gen-ts-adapter";
import { getChildren, trimTag } from "./util.js";
import { normalize } from "path";
import SchemaCache from "./SchemaCache.js";

export default class Analyzer {
  private schemaCache = new SchemaCache();
  constructor(private projectDir: string, private tsConfigName: string) {}

  start() {
    const configPath = ts.findConfigFile(
      this.projectDir,
      ts.sys.fileExists,
      this.tsConfigName
    );
    if (!configPath) {
      throw new Error("Could not find a valid 'tsconfig.json'.");
    }

    const config = ts.getParsedCommandLineOfConfigFile(
      configPath,
      ts.getDefaultCompilerOptions(),
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: () => {},
      }
    );
    if (!config) {
      throw new Error("Could not parse 'tsconfig.json'.");
    }

    const host = ts.createWatchCompilerHost(
      configPath,
      {},
      ts.sys,
      ts.createSemanticDiagnosticsBuilderProgram,
      (diagnostic) => {
        console.error(
          "Error",
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
        );
      },
      (diagnostic) => {
        console.log(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
        );
      }
    );

    host.afterProgramCreate = (program) => {
      console.log("prog create");
      const checker = program.getProgram().getTypeChecker();
      for (const file of program.getSourceFiles()) {
        this.visit(file, file, checker);
      }
      // const affectedFile = program.getSemanticDiagnosticsOfNextAffectedFile?.()?.affected;

      // if (affectedFile) {
      //   analyzeFile(affectedFile as any, checker);
      // }
    };

    ts.createWatchProgram(host);
  }

  private visit(
    sourceFile: ts.SourceFile,
    node: ts.Node,
    checker: ts.TypeChecker
  ) {
    if (!ts.isTaggedTemplateExpression(node)) {
      ts.forEachChild(node, (node) => this.visit(sourceFile, node, checker));
      return;
    }

    const tagName = node.tag.getText();
    if (tagName.endsWith(".sql")) {
      this.processSqlTemplate(sourceFile, node, checker);
    } else if (tagName.endsWith("schema")) {
      this.processDeclareSchemaTemplate(sourceFile, node, checker);
    }
  }

  private processDeclareSchemaTemplate(
    sourceFile: ts.SourceFile,
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
      const replacement = this.genRecordShapeCode(schemaRelations);
      // this.schemaCache.put();
      if (existingContent == normalize(replacement)) {
        return schemaRelations;
      }
      const pos = sourceFile.getLineAndCharacterOfPosition(range[0]);
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
    sourceFile: ts.SourceFile,
    node: ts.TaggedTemplateExpression,
    checker: ts.TypeChecker
  ) {
    const children = getChildren(node);
    const templateStringNode = children[children.length - 1];
    const schemaAccessNode = children[0];
    const schemaNode = getChildren(schemaAccessNode)[0];
    const schemaNodeSymbol = checker.getSymbolAtLocation(schemaNode);
    const decl = schemaNodeSymbol?.valueDeclaration;
    if (decl) {
      // this is the correct source file containing schema!
      console.log(decl.getSourceFile().fileName);
      // so based on file name we should be able to do
      // a "schema only" pass of the file
      // to pull and cache schema definitions
    }
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
        checker,
        decl!,
        templateStringNode.getText()
      );
      if (existingContent == normalize(replacement)) {
        return;
      }
      const pos = sourceFile.getLineAndCharacterOfPosition(range[0]);
      // TODO: replace!
      // context.report({
      //   message: `content does not match: ${replacement}`,
      //   loc: { line: pos.line, column: pos.character },
      //   fix: (fixer) => fixer.replaceTextRange(range, replacement),
      // });
    }
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
    checker: ts.TypeChecker,
    schemaNodeDecl: ts.Declaration,
    query: string
  ) {
    query = trimTag(query);

    // TODO: they could have passed many queries...
    try {
      let schemaRelations = this.schemaCache.getByType(checker, schemaType);
      if (schemaRelations == null) {
        schemaRelations = this.eagerlyProcessSchema(checker, schemaType);
      }
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
