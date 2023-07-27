import ts from "typescript";
import SchemaCache from "./SchemaCache.js";
import FileVisitor from "./FileVisitor.js";

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
      const visited = new Set<string>();
      for (const file of program.getSourceFiles()) {
        new FileVisitor(this.schemaCache, file, visited).visit(checker);
        // pull things that depend on `file` from the `dag` and visit those too!
        // the file visitor will ignore them if they were already visited.
      }
      // const affectedFile = program.getSemanticDiagnosticsOfNextAffectedFile?.()?.affected;

      // if (affectedFile) {
      //   analyzeFile(affectedFile as any, checker);
      // }
    };

    ts.createWatchProgram(host);
  }
}
