// 1. Start the service, register the watcher
// 2. Collect all schema defs and query uses to build the DAG
// 3. Process the files in the dag, schemas first

/*
We can resurrect this old approach:
https://github.com/vlcn-io/typed-sql/blob/77e12e5801eec6dbd1014be2b7037a55bb8fc66f/src/crawler.ts

to crawl and watch the files.
*/