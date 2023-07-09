import type * as eslint from "eslint";
import * as fs from "fs";
import { ESLintUtils } from "@typescript-eslint/utils";
import * as ts from "typescript";
import { get_relation_shapes } from "typed-sql-type-gen";

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

function visit(
  context: eslint.Rule.RuleContext,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  checker: ts.TypeChecker
) {
  if (ts.isCallExpression(node)) {
    const name = node.expression.getText();
    if (name === "createSQL") {
      processCreateSQL(context, sourceFile, node, checker);
    }
  } else if (ts.isTaggedTemplateExpression(node)) {
    const tagName = node.tag.getText();
    if (tagName === "sql") {
      processSqlTemplate(context, sourceFile, node, checker);
    }
  }

  ts.forEachChild(node, (node) => visit(context, sourceFile, node, checker));
}

function processCreateSQL(
  context: eslint.Rule.RuleContext,
  sourceFile: ts.SourceFile,
  node: ts.CallExpression,
  checker: ts.TypeChecker
) {
  const argumentNode = node.arguments[0];
  if (!ts.isStringTextContainingNode(argumentNode)) return;

  const typeNode = node.typeArguments?.[0];
  const existing = `<${typeNode?.getText()}>`;
  const replacement = genRecordShapeCode(argumentNode.text);
  if (normalize(existing) === normalize(replacement)) return;

  const range: [number, number] = [
    node.expression.getEnd(),
    node.typeArguments ? node.typeArguments.end + 1 : node.expression.getEnd(),
  ];
  const pos = sourceFile.getLineAndCharacterOfPosition(range[0]);
  context.report({
    message: `content does not match: ${replacement}`,
    loc: { line: pos.line, column: pos.character },
    fix: (fixer) => fixer.replaceTextRange(range, replacement),
  });
}

function processSqlTemplate(
  context: eslint.Rule.RuleContext,
  sourceFile: ts.SourceFile,
  node: ts.TaggedTemplateExpression,
  checker: ts.TypeChecker
) {
  const tagType = checker.getTypeAtLocation(node.tag);
  const signature = checker.getSignaturesOfType(tagType, ts.SignatureKind.Call);
  if (!signature.length) return;
  const sqlType = checker.getReturnTypeOfSignature(signature[0]);
  const schemaType = sqlType
    .getProperties()
    .find((x) => x.name.includes("schema"));
  if (!schemaType) return;

  const siblings = node.parent.getChildren();
  const nextNode = siblings[siblings.indexOf(node) + 2];
  const coerced =
    nextNode && ts.isIdentifier(nextNode) && nextNode.text === "as";

  const typeNode = node.typeArguments?.[0];
  const existing = typeNode ? `<${typeNode.getText()}>` : "";
  const replacement = coerced
    ? ""
    : calculateQueryShape(checker, schemaType, node.template.getText());
  if (normalize(existing) === normalize(replacement)) return;

  const range: [number, number] = [node.tag.getEnd(), node.template.getStart()];
  const pos = sourceFile.getLineAndCharacterOfPosition(range[0]);
  context.report({
    message: `content does not match: ${replacement}`,
    loc: { line: pos.line, column: pos.character },
    fix: (fixer) => fixer.replaceTextRange(range, replacement),
  });
}

type RecordName = string;
type PropName = string;
type PropType = string | undefined;
type RecordShapes = [RecordName, [PropName, PropType][]][];
function genRecordShapeCode(query: string): string {
  try {
    // TODO: fix me
    query = query.replace(/\`/g, "");
    const recordTypes = get_relation_shapes(query) as RecordShapes;
    return `<{
${recordTypes
  .map((r) => {
    return `  ${r[0]}: {
${genPropsCode(r[1])}
  }`;
  })
  .join(",\n")}
}>`;
  } catch (e) {
    console.log("some error");
    return `<${e}>` as string;
  }
}

function genPropsCode(props: [PropName, PropType][]) {
  // TODO: nullability!
  return props
    .map((p) => {
      return `    ${p[0]}: ${propTypeToTsType(p[1])}`;
    })
    .join(",\n");
}

function propTypeToTsType(t: PropType) {
  if (t == null) {
    return "any";
  }
  switch (t?.toUpperCase()) {
    case "TEXT":
      return "string";
    case "INTEGER":
    case "FLOAT":
      return "number";
    case "BOOL":
    case "BOOLEAN":
      return "boolean";
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

function calculateQueryShape(
  checker: ts.TypeChecker,
  schemaType: ts.Symbol,
  query: string
) {
  // const type = checker.getTypeOfSymbol(schemaType);
  // const props = type.getProperties();
  // top level props are records.
  // prop name is record name
  // prop type is record type
  // pack all these into dicts to pass over to type generator
  // https://rustwasm.github.io/wasm-bindgen/
  return "<ZOMG>";
}
