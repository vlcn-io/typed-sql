#!/usr/bin/env node

import { program } from "commander";
import Analyzer from "./Analyzer.js";

async function start() {
  program.requiredOption(
    "-p, --project <path>",
    "Path to the typescript project to analyze. This should be the directory containing the tsconfig.json."
  );
  program.option(
    "-t, --tsconfig <name>",
    "_name_ of your tsconfig file. Defaults to tsconfig.json"
  );

  program.parse();

  const options = program.opts();
  const projectPath = options.project;
  const tsconfig = options.tsconfig;

  const analyzer = new Analyzer(projectPath, tsconfig || "tsconfig.json");
  await analyzer.start();
}

start();
