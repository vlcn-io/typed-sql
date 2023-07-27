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

    let isCold = true;
    host.afterProgramCreate = (program) => {
      console.log("prog create");
      const checker = program.getProgram().getTypeChecker();

      if (isCold) {
        // process the entire repo.
        // First for schema defs (& apply fixes so presumably we're atomic?)
        // Then for query defs (& apply those fixes? will ts have re-read things? what if someone edits while we're updating?)
        // If we run into issues we can use `ts-patch` and do this as a proper transformer.
        // Then apply collected fixes.
        for (const file of program.getSourceFiles()) {
          new FileVisitor(this.schemaCache, this.dag, file).visitSchemaDefs(
            checker
          );
        }
        for (const file of program.getSourceFiles()) {
          new FileVisitor(this.schemaCache, this.dag, file).visitQueryDefs(
            checker
          );
        }
        isCold = false;
      } else {
        let affected:
          | ts.AffectedFileResult<readonly ts.Diagnostic[]>
          | undefined;
        while (
          (affected = program.getSemanticDiagnosticsOfNextAffectedFile())
        ) {
          const affectedFile = affected.affected as ts.SourceFile;
          console.log("Affected: " + affectedFile?.getSourceFile()?.fileName);
          new FileVisitor(this.schemaCache, this.dag, affectedFile).visitAll(
            checker
          );
          const children = this.dag.getDependents(affectedFile.fileName);
          console.log(children);
          for (const child of children) {
            const childFile = program.getSourceFile(child);
            // schemas can't rely on schemas so this should be fine.
            // well.. they could if you allow select statements in schemas that select from attached databases 🤣
            new FileVisitor(this.schemaCache, this.dag, childFile!).visitAll(
              checker
            );
          }
          // no consult the dag for anyone who depends on this file and analyze them too.
          // we can use `program.getSourceFile` or whatever to do this.
        }
      }
    };

    ts.createWatchProgram(host);
  }
}
