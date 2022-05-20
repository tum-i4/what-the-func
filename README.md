# What the func?! - A simple C++ function parser/tagger

This project implements a simple C++ function parser, `what-the-func`, based on the [tree-sitter](https://tree-sitter.github.io/) [C++ grammar](https://github.com/tree-sitter/tree-sitter-cpp).
Similar to source code taggers such as `ctags`, `what-the-func` can be used to detect all function definitions in C++ source files as required, e.g., for function-level regression test selection.

## Build

To build and run the project, you need [NodeJS](https://nodejs.org/en/) >= 14.

```shell
$ npm install
$ npm run build  # will transpile TypeScript sources
```

## Run

```shell
# sample C++ file
$ cat foo.cpp
int max(int a, int b) {
  return a > b ? a : b;
}

# build and run `what-the-func` with arguments
$ npm run start -- -f foo.cpp
{"name":"max(int a, int b)","start":1,"end":3,"properties":[],"file":"/path/to/foo.cpp"}

# or, if using executable binary
$ what-the-func -f foo.cpp
{"name":"max(int a, int b)","start":1,"end":3,"properties":[],"file":"/path/to/foo.cpp"}
```

## Test

```shell
$ npm run test  # executes jest test suite
```

## Package

```shell
$ npm run package  # builds project and generates executable `what-the-func` binary for current platform (into ./dist)
```

## Contributors

Built and maintained by Daniel Elsner (daniel.elsner<at>tum.de).
