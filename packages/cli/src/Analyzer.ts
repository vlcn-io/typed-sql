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
      const seen = new Set<string>();
      for (const file of program.getSourceFiles()) {
        if (seen.has(file.fileName)) {
          continue;
        }
        this.visit(file, checker);
        // pull things that depend on `file` from the `dag` and visit those too
        // if they have not already been visited.
        // well if they've already been visited then the base file was visited too through them...
        // so when we hit file, we should check the dag to see if anything that uses file was already visited
        // if so we can skip file b/c it was done in the recursive file visit step.
        // but we still must visit all the users of the file, even if we do not visit the file itself.
        // so:
        // - get file
        // - check if seen has it, if so skip
        // - get all files that depend on file from DAG
        // - seen if any of those are in seen. If so, do not process current file
        // - for the rest of the dependents no in the DAG, visit them
        // - add them all to seen
        // - continue
        // log in our schema cache if we keep re-visiting the same schema file.
        // hmm...
        // Maybe file visitor should instead return a list of unresolved dependencies and the file itself.
        // As this list builds up,
        // we visit all the unresolved dependencies.
        // once all depenencies are resolved, we visit the dependents.
        // this prevents re-processing the same file over and manages the DAG with the function call stack
        seen.add(file.fileName);
      }
      // const affectedFile = program.getSemanticDiagnosticsOfNextAffectedFile?.()?.affected;

      // if (affectedFile) {
      //   analyzeFile(affectedFile as any, checker);
      // }
    };

    ts.createWatchProgram(host);
  }

  private visit(sourceFile: ts.SourceFile, checker: ts.TypeChecker) {
    new FileVisitor(this.schemaCache, sourceFile).visit(checker);
  }
}
