import ts from "typescript";
import SchemaCache from "../SchemaCache.js";
import DependencyGraph from "../DependencyGraph.js";

export default class SchemaTypeBuilder {
  constructor(
    private schemaCache: SchemaCache,
    private dag: DependencyGraph,
    private sourceFile: ts.SourceFile
  ) {}

  /**
   * Given a declaration, returns the type if it already exists in the cache.
   * Builds it and caches it if it does not.
   */
  getOrBuildTypeFromDeclaration() {
    // here we can add a link in the dag if the declaration is not defined in this file.
    // if (decl not in this_file) {
    //   this.dag.addDependent(decl, this_file);
    // }
  }

  /**
   * Builds all of the types for the schemas that are resident to the current
   * file.
   *
   * This clears the schema type cache for that fill and re-builds it.
   */
  buildResidentTypes(schemaDefinitions: ts.TaggedTemplateExpression[]) {}
}
