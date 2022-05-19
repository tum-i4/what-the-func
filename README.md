# What the func?! - A simple C++ function parser/tagger

This project implements a simple C++ function parser, `what-the-func`, based on the [tree-sitter](https://tree-sitter.github.io/) [C++ grammar](https://github.com/tree-sitter/tree-sitter-cpp).

## Build

To build and run the project, you need [NodeJS](https://nodejs.org/en/) >= 14.

```shell
$ npm install
$ npm run build  # will transpile TypeScript sources
```

## Run

```shell
$ npm run start -- -f file.cpp   # will build and run `what-the-func` with arguments 
```

## Test

```shell
$ npm run test  # executes jest test suite
```

## Package

```shell
$ npm run package  # builds project and generates executable `what-the-func` binary for current platform (into ./dist)
```
