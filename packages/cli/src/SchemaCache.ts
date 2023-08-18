/**
 * The Analyzer will process files as given them by TypeScript.
 *
 * If a file has a query that query will depend on a schema.
 *
 * The analyzer will ask this cache for the types defined by the schema.
 *
 * The cache will return them if they exist.
 *
 * If they do not exist (because the schema definition has not yet been processed)
 * then the Analyzer must open the file containing the schema (by following imports),
 * process the schema, add the results to the cache, resume processing of the query
 * that caused the cache miss.
 *
 * The assumption is that we can go resulve an import and
 * open the file. We shall see.
 */

import { getDdlRelations } from "@vlcn.io/type-gen-ts-adapter";
import crypto from "crypto";

export default class SchemaCache {
  private map = new Map<
    string,
    Map<string, ReturnType<typeof getDdlRelations>>
  >();
  // cache on file name + schema content hash.
  // we can actually get the schema declaration in its entirity from a query site.
  // this means we don't have to do weir visitation of other files.
  // when the file containing schemas itself changes it'll nuke the cache for that file since it'll
  // fill in all schemas afterwards.
  get(
    fileName: string,
    loc: string
  ): ReturnType<typeof getDdlRelations> | null {
    const existing = this.map.get(fileName);
    if (!existing) {
      return null;
    }
    return existing.get(loc) || null;
  }

  cache(
    fileName: string,
    loc: string,
    schema: ReturnType<typeof getDdlRelations>
  ) {
    let existing = this.map.get(fileName);
    if (existing == null) {
      existing = new Map();
      this.map.set(fileName, existing);
    }
    existing.set(loc, schema);
  }

  clearForFile(fileName: string) {
    // this'll be called whenever we do a full re-process of a specific file since that file will end up
    // building all the relations it declares.
    this.map.delete(fileName);
  }

  log() {
    console.log(this.map);
  }
}

function hash(s: string): string {
  const shasum = crypto.createHash("sha1");
  shasum.update(s);
  return shasum.digest("hex");
}
