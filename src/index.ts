#!/usr/bin/env node

import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import path from 'path';
import {existsSync, readFileSync} from 'fs';
import {parseSourceCode} from './parser';

// Set up simple CLI.
// We use yargs to be open for future extensions.
const options: any = yargs(hideBin(process.argv))
    .usage("Usage: <file>")
    .option("file", {alias: "f", describe: "C++ file to analyze", type: "string", demandOption: true})
    .argv;

// Validate input file.
const {file} = options;
const cppFilePath = path.resolve(file);
if (!existsSync(cppFilePath)) {
    console.error(`C++ file at ${cppFilePath} does not exist, please provide valid filepath.`);
    process.exit(1);
}

// Parse source file.
try {
    const sourceCode = readFileSync(cppFilePath).toString();
    const functions = parseSourceCode(sourceCode);
    process.stdout.write(functions.map(o => JSON.stringify(o)).join('\n'));
} catch (err) {
    console.error(`Failed to read source file: ${err}`)
    process.exit(1);
}


