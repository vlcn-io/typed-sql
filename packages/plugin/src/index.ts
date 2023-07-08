import type * as eslint from 'eslint';
import * as fs from 'fs';
import { ESLintUtils } from '@typescript-eslint/utils';
import * as ts from 'typescript';
import { get_relation_shapes } from 'typed-sql-type-gen';

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

function visit(context: eslint.Rule.RuleContext, sourceFile: ts.SourceFile, node: ts.Node, checker: ts.TypeChecker) {
  if (!ts.isTaggedTemplateExpression(node)) {
    ts.forEachChild(node, (node) => visit(context, sourceFile, node, checker));
    return;
  }

  const tagName = node.tag.getText();
  if (tagName.endsWith('.sql')) {
    processSqlTemplate(context, sourceFile, node, checker);
  } else if (tagName.endsWith('declareSchema')) {
    processDeclareSchemaTemplate(context, sourceFile, node, checker);
  }
}

function processSqlTemplate(
  context: eslint.Rule.RuleContext,
  sourceFile: ts.SourceFile,
  node: ts.TaggedTemplateExpression,
  checker: ts.TypeChecker
) {
  const children = getChildren(node);
  const templateStringNode = children[children.length - 1];
  const schemaAccessNode = children[0];
  const schemaNode = getChildren(schemaAccessNode)[0];
  const schemaType = checker.getTypeAtLocation(schemaNode).getProperty('__type')!;
  // range of text to replace. Inclusive of `<` and `>` if they exist.
  const range: [number, number] = [schemaAccessNode.getEnd(), templateStringNode.getStart()];
  const maybeExistingNode = children[1];
  if (ts.isTemplateLiteral(templateStringNode)) {
    // process it, extracting type information
    let existingContent = '';
    if (maybeExistingNode != templateStringNode) {
      existingContent = normalise(`<${maybeExistingNode.getText()}>`);
    }
    const replacement = calculateQueryShape(checker, schemaType, templateStringNode.getText());
    if (existingContent == normalise(replacement)) {
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

function processDeclareSchemaTemplate(
  context: eslint.Rule.RuleContext,
  sourceFile: ts.SourceFile,
  node: ts.TaggedTemplateExpression,
  checker: ts.TypeChecker
) {
  const children = getChildren(node);
  const templateStringNode = children[children.length - 1];
  const maybeExistingNode = children[1];
  const schemaAccessNode = children[0];
  const range: [number, number] = [schemaAccessNode.getEnd(), templateStringNode.getStart()];
  if (ts.isTemplateLiteral(templateStringNode)) {
    let existingContent = '';
    if (maybeExistingNode != templateStringNode) {
      existingContent = normalise(`<${maybeExistingNode.getText()}>`);
    }
    const replacement = genRecordShapeCode(templateStringNode.getText());
    if (existingContent == normalise(replacement)) {
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

type RecordName = string;
type PropName = string;
type PropType = string | undefined;
type RecordShapes = [RecordName, [PropName, PropType][]][];
function genRecordShapeCode(query: string): string {
  try {
    // TODO: fix me
    query = query.replace(/\`/g, '');
    const recordTypes = get_relation_shapes(query) as RecordShapes;
    return `<{
${recordTypes.map(r => {
        return `  ${r[0]}: {
${genPropsCode(r[1])}
  }`;
      }).join(",\n")}
}>`;
  } catch (e) {
    console.log('some error');
    return `<${e}>` as string;
  }
}

function genPropsCode(props: [PropName, PropType][]) {
  // TODO: nullability!
  return props.map(p => {
    return `    ${p[0]}: ${propTypeToTsType(p[1])}`;
  }).join(",\n");
}

function propTypeToTsType(t: PropType) {
  if (t == null) {
    return 'any';
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

const normalise = (val: string) => val.trim().replace(/\s/g, ' ');

function calculateQueryShape(checker: ts.TypeChecker, schemaType: ts.Symbol, query: string) {
  // const type = checker.getTypeOfSymbol(schemaType);
  // const props = type.getProperties();
  // top level props are records.
  // prop name is record name
  // prop type is record type
  // pack all these into dicts to pass over to type generator
  // https://rustwasm.github.io/wasm-bindgen/
  return '<ZOMG>';
}