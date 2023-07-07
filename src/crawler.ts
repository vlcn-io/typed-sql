import * as ts from 'typescript';

function visit(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isTaggedTemplateExpression(node)) {
    const tagName = node.tag.getText();

    if (tagName.endsWith('.sql')) {
      const tagType = checker.getTypeAtLocation(node.tag);

      const signature = checker.getResolvedSignature(node);
      // // const params = signature?.getParameters() || [];
      // console.log('Type Params: ', tagType.getCallSignatures()[0].typeParameters);
      // console.log('Type args: ', tagType.aliasTypeArguments);
      // console.log('Props: ', tagType.getCallSignatures()[0].typeParameters![0].);
      // for (const param of params) {
      //   const type = checker.getTypeOfSymbolAtLocation(param, node);
      //   // outputs -- Ctor<Bar>
      //   console.log('Param Type: ', checker.typeToString(type));
      // }

      // Just parse `node.getText` to pull the name?
      // Generate type via that name after parsing SQL string
      console.log(`Found an SQL template at ${node.getFullStart()}: ${node.getText()}`);
      console.log(`Type of tag is: ${checker.typeToString(tagType)}`);

      // node.chil
      // get children
      // if 2, no generic
      // if 3, generic. we can gen.
      // 0 is identifier
      // 1 is generic (subclass of?)
      // 2 is template expression
      // https://ts-ast-viewer.com/#code/GYVwdgxgLglg9mABMOcA8AVAfACgIYBciGApgLYAOANnlCQMpQBOMYA5gM4CCTTeAngBpEAOjEAjInjD8A2gF0AlIgDeAXwBQGqPwolEADUQBeVWoDcWlOgNYABgHcYVKogAkK62sQP9ACzwAN30oPw0SMFgmfkRQ1jY7cyA
    }
  }

  ts.forEachChild(node, (node) => visit(node, checker));
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
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  );

  host.afterProgramCreate = (program) => {
    console.log('prog create');
    const checker = program.getProgram().getTypeChecker();
    for (const file of program.getSourceFiles()) {
      visit(file, checker);
    }
    // const affectedFile = program.getSemanticDiagnosticsOfNextAffectedFile?.()?.affected;

    // if (affectedFile) {
    //   analyzeFile(affectedFile as any, checker);
    // }
  };

  ts.createWatchProgram(host);
}

function analyzeFile(file: ts.SourceFile, checker: ts.TypeChecker) {
  visit(file, checker);
}

console.log('Call analyze');
analyzeProject('./');
