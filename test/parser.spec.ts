import {CppFunction, FunctionProperty, parseSourceCode} from '../src/parser'
import {readFileSync} from 'fs';
import path from 'path';

const createCppFunction: (name: string, start: number, end: number, properties?: FunctionProperty[], className?: string, namespace?: string)
    => CppFunction = (name, start, end, properties = [], className = undefined, namespace = undefined) => {
    return {
        name,
        start,
        end,
        properties,
        className,
        namespace,
    }
}

describe('simple C++ function parsing', () => {

    test('global function', () => {
        expect(parseSourceCode(`
void foo() {
    return;
}`)).toEqual([createCppFunction("foo()", 1, 3)]);
    });

    test('class member function', () => {
        expect(parseSourceCode(`
class A {
public:
    int foo() {return 1;}
private:
    void bar() {
        return;
    }
};
`)).toEqual([
            createCppFunction("foo()", 3, 3, [], "A"),
            createCppFunction("bar()", 5, 7, [], "A"),
        ]);
    });

    test('class member + global function', () => {
        expect(parseSourceCode(`
class A {
public:
    int foo() {return 1;}
private:
    void bar() {
        return;
    }
};

void baz(int a, int b) {
    return;
}
`)).toEqual([
            createCppFunction("foo()", 3, 3, [], "A"),
            createCppFunction("bar()", 5, 7, [], "A"),
            createCppFunction("baz(int a, int b)", 10, 12),
        ]);
    });

    test('namespace + class/struct (static) member + global function', () => {
        expect(parseSourceCode(`
void baz(int a, int b) {
    return;
}
namespace {
    void anon() {}   
}

namespace x {
    struct B {
        void baz() {}
    };

    class A {
    public:
        int foo() {return 1;}
        static int foo1() {return 1;}
        void foo2();
    private:
        void bar() {
            return;
        }
    };
    
    void A::foo2() {}
}
`)).toEqual([
            createCppFunction("baz(int a, int b)", 1, 3),
            createCppFunction("anon()", 5, 5, [], undefined, "anon-id-4-6"),
            createCppFunction("baz()", 10, 10, [], "B", "x"),
            createCppFunction("foo()", 15, 15, [], "A", "x"),
            createCppFunction("foo1()", 16, 16, [], "A", "x"),
            createCppFunction("bar()", 19, 21, [], "A", "x"),
            createCppFunction("A::foo2()", 24, 24, [], undefined, "x"),
        ]);
    });
});

test('parse complex C++ file', () => {
    const file = path.resolve(__dirname, "..", "test", "test.cpp");
    expect(parseSourceCode(readFileSync(file).toString())).toEqual([
        createCppFunction("weird_add(int a, int b)", 10, 13),
        createCppFunction("CustomPair(T first, T second)", 21, 24, [], "CustomPair", "templates"),
        createCppFunction("~CustomPair()", 26, 26, [], "CustomPair", "templates"),
        createCppFunction("GetMax()", 29, 32, [], "CustomPair", "templates"),
        createCppFunction("GetMax(T a, T b)", 37, 39, [], undefined, "templates"),
        createCppFunction("foo()", 45, 47, [], "A"),
        createCppFunction("foo() override", 54, 56, [], "C"),
        createCppFunction("bar(int c)", 58, 59, [], "C"),
        createCppFunction("baz()", 61, 63, [], "C"),
        createCppFunction("foo()", 73, 73, [], "Foo", "Base"),
        createCppFunction("bar()", 79, 79, [], "Bar", "Base"),
        createCppFunction("Foo<int,int>::foo()", 83, 83, [], undefined, "Base"),
        createCppFunction("foo(X& x, Y& y)", 87, 90, []),
        createCppFunction("foo_bar(X& x, Y& y)", 93, 95, []),
        createCppFunction("main()", 97, 97, []),
    ]);
})
