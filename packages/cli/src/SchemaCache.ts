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
