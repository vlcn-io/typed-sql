import type * as eslint from 'eslint';
import expect from 'expect';
import { tryCatch } from 'fp-ts/lib/Either';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { ESLintUtils } from '@typescript-eslint/utils';
import * as ts from 'typescript';

const codegen: eslint.Rule.RuleModule = {
  // @ts-expect-error types are wrong?
  meta: { fixable: true },
  create(context: eslint.Rule.RuleContext) {
    const sourcePath = context.filename;
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      // replace current content with exception information and return.
      throw Error(`Source path is not a file: ${sourcePath}`);
    }
    // cast to any seems to be required due to @types/eslint not being up to date to 8.44.0
    const { program } = ESLintUtils.getParserServices(context as any);
    const sourceFile = program.getSourceFile(sourcePath)!;
    const checker = program.getTypeChecker();
    visit(context, sourceFile, checker);

    // const position = (index: number) => {
    //   const stringUpToPosition = sourceCode.slice(0, index);
    //   const lines = stringUpToPosition.split(os.EOL);
    //   return { line: lines.length, column: lines[lines.length - 1].length };
    // };

    // const startMatches = [...matchAll(sourceCode, markers.start)].filter((startMatch) => {
    //   const prevCharacter = sourceCode[startMatch.index! - 1];
    //   return !prevCharacter || prevCharacter === '\n';
    // });

    startMatches.forEach((startMatch, startMatchesIndex) => {
      // const range: eslint.AST.Range = [startIndex + startMatch[0].length + os.EOL.length, endMatch.index!];
      // const existingContent = sourceCode.slice(...range);
      // const normalise = (val: string) => val.trim().replace(/\r?\n/g, os.EOL);
      // if (result._tag === 'Left') {
      //   context.report({ message: result.left, loc: startMarkerLoc });
      //   return;
      // }
      // const expected = result.right;
      // try {
      //   expect(normalise(existingContent)).toBe(normalise(expected));
      // } catch (e: unknown) {
      //   const loc = { start: position(range[0]), end: position(range[1]) };
      //   context.report({
      //     message: `content doesn't match: ${e}`,
      //     loc,
      //     fix: (fixer) => fixer.replaceTextRange(range, normalise(expected) + os.EOL),
      //   });
      // }
    });

    // TODO: should we not just put in our node type selectors instead of processing the entire file?
    return {};
  },
};

function visit(context: eslint.Rule.RuleContext, node: ts.Node, checker: ts.TypeChecker) {}

export const rules = { codegen };
