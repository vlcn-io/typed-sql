import ts from "typescript";
import SchemaCache from "./SchemaCache.js";
import FileVisitor from "./file_visitor/FileVisitor.js";
import DependencyGraph from "./DependencyGraph.js";

export default class Analyzer {
  // The schema cache and dag are stateful given the analyzer will watch a folder for file modifications.
  private schemaCache = new SchemaCache();
  private dag = new DependencyGraph();
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
      const dependents = new Set<string>();
      // TODO: is this incremental? Or we need `affectedFile` some such?
      for (const file of program.getSourceFiles()) {
        if (visited.has(file.fileName)) {
          continue;
        }
        visited.add(file.fileName);
        new FileVisitor(this.schemaCache, this.dag, file).visit(checker);
        // pull things that depend on `file` from the `dag` and visit those too if they've not been visited!
      }
      // const affectedFile = program.getSemanticDiagnosticsOfNextAffectedFile?.()?.affected;

      // if (affectedFile) {
      //   analyzeFile(affectedFile as any, checker);
      // }
    };

    ts.createWatchProgram(host);
  }
}
