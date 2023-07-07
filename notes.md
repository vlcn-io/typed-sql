https://chat.openai.com/share/098cf757-0a51-484f-b9ae-2097b910f9b2

Incremental crawler:

```ts
import * as ts from 'typescript';
import * as fs from 'fs';

function visit(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isTaggedTemplateExpression(node)) {
    const tagName = node.tag.getText();

    if (tagName.endsWith('.sql')) {
      const tagType = checker.getTypeAtLocation(node.tag);

      if (tagType.isReference()) {
        const typeArguments = tagType.typeArguments;
        if (typeArguments) {
          console.log(`Type arguments: ${typeArguments.map((arg) => checker.typeToString(arg)).join(', ')}`);
        }
      }

      console.log(`Found an SQL template at ${node.getFullStart()}: ${node.getText()}`);
      console.log(`Type of tag is: ${checker.typeToString(tagType)}`);
    }
  }

  ts.forEachChild(node, visit.bind(null, checker));
}

function analyzeFile(file: ts.SourceFile, checker: ts.TypeChecker) {
  visit(file, checker);
}

function analyzeProject(projectDir: string) {
  const configPath = ts.findConfigFile(projectDir, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.");
  }

  const config = ts.getParsedCommandLineOfConfigFile(configPath, ts.getDefaultCompilerOptions(), {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: () => {},
  });
  if (!config) {
    throw new Error("Could not parse 'tsconfig.json'.");
  }

  const host = ts.createWatchCompilerHost(
    configPath,
    {},
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    (diagnostic) => {
      console.error('Error', ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
    (diagnostic) => {
      console.info(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  );

  host.afterProgramCreate = (program) => {
    const checker = program.getProgram().getTypeChecker();
    const affectedFiles = program.getSemanticDiagnosticsOfNextAffectedFile?.()?.affected;

    if (affectedFiles) {
      if (Array.isArray(affectedFiles)) {
        affectedFiles.forEach((file) => analyzeFile(file, checker));
      } else {
        analyzeFile(affectedFiles, checker);
      }
    }
  };

  ts.createWatchProgram(host);
}

analyzeProject('/path/to/your/project');
```

And with a language service we could even limit recomputations to changed sections of the file. https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API

non watch?

```ts
import * as ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';

function visit(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isTaggedTemplateExpression(node)) {
    const tagName = node.tag.getText();

    if (tagName.endsWith('.sql')) {
      const tagType = checker.getTypeAtLocation(node.tag);

      const signature = checker.getResolvedSignature(node);
      const params = signature?.getParameters() || [];
      for (const param of params) {
        const type = checker.getTypeOfSymbolAtLocation(param, node);
        // outputs -- Ctor<Bar>
        console.log(checker.typeToString(type));
      }

      console.log(`Found an SQL template at ${node.getFullStart()}: ${node.getText()}`);
      console.log(`Type of tag is: ${checker.typeToString(tagType)}`);
    }
  }

  ts.forEachChild(node, (node) => visit(node, checker));
}

function analyzeProject(projectDir: string) {
  const configPath = ts.findConfigFile(projectDir, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.");
  }

  const parsedCmd = ts.getParsedCommandLineOfConfigFile(configPath, ts.getDefaultCompilerOptions(), {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: () => {},
  });
  if (!parsedCmd) {
    throw new Error("Could not parse 'tsconfig.json'.");
  }

  const program = ts.createProgram(parsedCmd.fileNames, parsedCmd.options);
  const checker = program.getTypeChecker();

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile) {
      visit(sourceFile, checker);
    }
  }
}

analyzeProject('./');
```
