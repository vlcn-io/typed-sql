import type * as eslint from "eslint";
import * as fs from "fs";
import { ESLintUtils } from "@typescript-eslint/utils";
import * as ts from "typescript";
import {
  parseDdlRelations,
  getDdlRelations,
  getQueryRelations,
  parseQueryRelations,
} from "@vlcn.io/type-gen-ts-adapter";

const codegen: eslint.Rule.RuleModule = {
  // @ts-expect-error types are wrong?
  meta: { fixable: true },
  create(context: eslint.Rule.RuleContext) {
    const sourcePath = context.filename;
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      // TODO: replace current content with exception information and return.
      throw Error(`Source path is not a file: ${sourcePath}`);
    }
    // cast to any seems to be required due to @types/eslint not being up to date to 8.44.0
    const { program } = ESLintUtils.getParserServices(context as any);
    const sourceFile = program.getSourceFile(sourcePath)!;
    const checker = program.getTypeChecker();
    visit(context, sourceFile, sourceFile, checker);
    return {};
  },
};

// TODO: temporary hack for demonstration purposes
// In reality we need a DAG of dependencies and a place to save
// schemaRelations tied to . . . schema name or type symbol or something stable
// to look up in a future pass over source files.
let schemaRelations: ReturnType<typeof getDdlRelations> | null = null;
function visit(
  context: eslint.Rule.RuleContext,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  checker: ts.TypeChecker
) {
  if (!ts.isTaggedTemplateExpression(node)) {
    ts.forEachChild(node, (node) => visit(context, sourceFile, node, checker));
    return;
  }

  const tagName = node.tag.getText();
  console.log(tagName);
  if (tagName.endsWith(".sql")) {
    processSqlTemplate(context, sourceFile, node, checker, schemaRelations!);
  } else if (tagName.endsWith("declareSchema")) {
    schemaRelations = processDeclareSchemaTemplate(
      context,
      sourceFile,
      node,
      checker
    );
  }
}

function processDeclareSchemaTemplate(
  context: eslint.Rule.RuleContext,
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
    // TODO: fixme. Just trim first and last `
    const schemaRelations = getDdlRelations(
      templateStringNode.getText().replace(/\`/g, "")
    );
    const replacement = genRecordShapeCode(schemaRelations);
    if (existingContent == normalize(replacement)) {
      return schemaRelations;
    }
    const pos = sourceFile.getLineAndCharacterOfPosition(range[0]);
    context.report({
      message: `content does not match: ${replacement}`,
      loc: { line: pos.line, column: pos.character },
      fix: (fixer) => fixer.replaceTextRange(range, replacement),
    });

    return schemaRelations;
  }

  return [];
}

function processSqlTemplate(
  context: eslint.Rule.RuleContext,
  sourceFile: ts.SourceFile,
  node: ts.TaggedTemplateExpression,
  checker: ts.TypeChecker,
  schemaRelations: ReturnType<typeof getDdlRelations>
) {
  const children = getChildren(node);
  const templateStringNode = children[children.length - 1];
  const schemaAccessNode = children[0];
  const schemaNode = getChildren(schemaAccessNode)[0];
  const schemaType = checker
    .getTypeAtLocation(schemaNode)
    .getProperty("__type")!;
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
    const replacement = genQueryShape(
      checker,
      schemaType,
      templateStringNode.getText(),
      schemaRelations
    );
    if (existingContent == normalize(replacement)) {
      return;
    }
    const pos = sourceFile.getLineAndCharacterOfPosition(range[0]);
    context.report({
      message: `content does not match: ${replacement}`,
      loc: { line: pos.line, column: pos.character },
      fix: (fixer) => fixer.replaceTextRange(range, replacement),
    });
  }
}

// TODO: take in original indentation offset
function genRecordShapeCode(
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
    return `</*${e.message}*/>` as string;
  }
}

export const rules = { codegen };

function getChildren(node: ts.Node): ts.Node[] {
  const ret: ts.Node[] = [];
  node.forEachChild((c) => {
    ret.push(c);
  });
  return ret;
}

const normalize = (val: string) =>
  val.trim().replace(/\s/g, " ").replace(/,|;/g, "");

function genQueryShape(
  checker: ts.TypeChecker,
  schemaType: ts.Symbol,
  query: string,
  schemaRelations: ReturnType<typeof getDdlRelations>
) {
  // TODO: fixme! We only want to replace first and last occurrence of `
  query = query.replaceAll("`", "");

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
    return `<{
  ${Object.entries(shape)
    .map(([key, value]) => {
      return `${key}: ${value}`;
    })
    .join(",\n  ")}
}>`;
  } catch (e: any) {
    return `</*
${e.message}
*/>`;
  }
}
