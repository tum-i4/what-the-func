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
}`.trimStart())).toEqual([createCppFunction("foo()", 1, 3)]);
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
`.trimStart())).toEqual([
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
`.trimStart())).toEqual([
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
`.trimStart())).toEqual([
            createCppFunction("baz(int a, int b)", 1, 3),
            createCppFunction("anon()", 5, 5, [], undefined, "anon-id-4-6"),
            createCppFunction("baz()", 10, 10, [], "B", "x"),
            createCppFunction("foo()", 15, 15, [], "A", "x"),
            createCppFunction("foo1()", 16, 16, ['static'], "A", "x"),
            createCppFunction("bar()", 19, 21, [], "A", "x"),
            createCppFunction("A::foo2()", 24, 24, [], undefined, "x"),
        ]);
    });

    test('support macro functions', () => {
        expect(parseSourceCode(`
#define FOO 123
#define MAX(a,b) a > b ? a:b
void foo() {} 
`.trimStart())).toEqual([
            createCppFunction("MAX", 2, 2, ['macro']),
            createCppFunction("foo()", 3, 3)
        ]);
    });

    test('functions with const return type', () => {
        expect(parseSourceCode(`
const auto& foo(int a) { return 1; }
`.trimStart())).toEqual([
            createCppFunction("& foo(int a)", 1, 1)
        ]);
    });

    test('const functions', () => {
        expect(parseSourceCode(`
void foo() const {}
`.trimStart())).toEqual([
            createCppFunction("foo()", 1, 1, ['const'])
        ]);
    });

    test('decltype functions', () => {
        expect(parseSourceCode(`
int x = 1;
decltype(auto) foo() { return x; }
`.trimStart())).toEqual([
            createCppFunction("foo()", 2, 2)
        ]);
    });

    test('static functions', () => {
        expect(parseSourceCode(`
static void foo() { return x; }
struct A {
    static void foo(int a) {}
};
`.trimStart())).toEqual([
            createCppFunction("foo()", 1, 1, ['static']),
            createCppFunction("foo(int a)", 3, 3, ['static'], 'A')
        ]);
    });

    test('volatile functions', () => {
        expect(parseSourceCode(`
struct A {
    void foo(int a) volatile {}
};
`.trimStart())).toEqual([
            createCppFunction("foo(int a)", 2, 2, ['volatile'], 'A')
        ]);
    });

    test('inline functions', () => {
        expect(parseSourceCode(`
inline int foo(int a, int b)
{
    return a + b;
}
`.trimStart())).toEqual([
            createCppFunction("foo(int a, int b)", 1, 4)
        ]);
    });

    test('virtual/override functions', () => {
        expect(parseSourceCode(`
struct Base
{
    virtual void f()
    {
    }
};
 
struct Derived : Base
{
    void f() override // 'override' is optional
    {
    }
};
`.trimStart())).toEqual([
            createCppFunction("f()", 3, 5, ['virtual'], "Base"),
            createCppFunction("f()", 10, 12, ['override'], "Derived"),
        ]);
    });

    test('template functions', () => {
        expect(parseSourceCode(`
template<class T>
auto foo(T t) { return t; }
`.trimStart())).toEqual([
            createCppFunction("foo(T t)", 2, 2, ['template'])
        ]);
    });

    test('complex template functions', () => {
        expect(parseSourceCode(`
template<typename... Variadic, typename ...Args>
constexpr void invoke(auto (*fun)(Variadic......), Args... args)
{
    fun(args...);
}
`.trimStart())).toEqual([
            createCppFunction("invoke(auto (*fun)(Variadic......), Args... args)", 2, 5, ['template'])
        ]);
    });

    test('template de-/constructors', () => {
        expect(parseSourceCode(`
template<class T> struct A
{
    explicit A(const T&, ...) noexcept {};
    A(T&&, ...) {};
    A<T>(T&&, ...) {};
    ~A() {};
    
    template<class Iter>
    auto bar(Iter b, Iter e)
    {
        return X<typename Iter::value_type>(b, e); // must specify what we want
    }
};
`.trimStart())).toEqual(expect.arrayContaining([
            createCppFunction("A(const T&, ...) noexcept", 3, 3, [], "A"),
            createCppFunction("A(T&&, ...)", 4, 4, [], "A"),
            createCppFunction("A<T>(T&&, ...)", 5, 5, [], "A"),
            createCppFunction("~A()", 6, 6, [], "A"),
            createCppFunction("bar(Iter b, Iter e)", 9, 12, ['template'], "A"),
        ]));
    });

    test('template specialization', () => {
        expect(parseSourceCode(`
template<typename T>
class A
{
    template<typename A, typename B>
    auto foo(A* a) const
        -> decltype(a->GetType())
    {
        return true;
    }
};

template<>
class A<B>
{
    template<typename A, typename B>
    auto foo(A* a) const -> decltype(a->GetType())
    {
        return true;
    }
};
    
`.trimStart())).toEqual([
            createCppFunction("foo(A* a) -> decltype(a->GetType())", 5, 9, ['const', 'template'], "A"),
            createCppFunction("foo(A* a) -> decltype(a->GetType())", 16, 19, ['const', 'template'], "A<B>"),
        ]);
    });

    test('operator overloading', () => {
        expect(parseSourceCode(`
struct X {
    X& operator++()
    {
        return *this;
    }
    
    X& operator+=(const X& rhs)
    {
        return *this;
    }
    
    friend X operator+(X lhs,
                     const X& rhs)
    {
        lhs += rhs;
        return lhs;
    }
    
    void operator()(int n) { printf(n); }
};
`.trimStart())).toEqual([
            createCppFunction("& operator++()", 2, 5, [], "X"),
            createCppFunction("& operator+=(const X& rhs)", 7, 10, [], "X"),
            createCppFunction("operator+(X lhs, X& rhs)", 12, 17, ['const'], "X"),
            createCppFunction("operator()(int n)", 19, 19, [], "X"),
        ]);
    });

    test('nested structures', () => {
        expect(parseSourceCode(`
struct A {
    struct B {
        void foo() {}
    };
};
`.trimStart())).toEqual([
            createCppFunction("foo()", 3, 3, [], "B")
        ]);
    });
});

test('parse complex C++ file', () => {
    const file = path.resolve(__dirname, "test.cpp");
    expect(parseSourceCode(readFileSync(file).toString())).toEqual([
        createCppFunction("MAX", 6, 8, ["macro"]),
        createCppFunction("weird_add(int a, int b)", 11, 14),
        createCppFunction("CustomPair(T first, T second)", 22, 25, [], "CustomPair", "templates"),
        createCppFunction("~CustomPair()", 27, 27, [], "CustomPair", "templates"),
        createCppFunction("GetMax()", 30, 33, [], "CustomPair", "templates"),
        createCppFunction("GetMax(T a, T b)", 38, 40, ['template'], undefined, "templates"),
        createCppFunction("foo()", 46, 48, ['virtual'], "A"),
        createCppFunction("foo()", 55, 57, ['override'], "C"),
        createCppFunction("bar(int c)", 59, 60, [], "C"),
        createCppFunction("baz()", 62, 64, [], "C"),
        createCppFunction("foo()", 74, 74, [], "Foo", "Base"),
        createCppFunction("bar()", 80, 80, [], "Bar", "Base"),
        createCppFunction("Foo<int,int>::foo()", 84, 84, ['template'], undefined, "Base"),
        createCppFunction("foo(X& x, Y& y)", 88, 91, ['template']),
        createCppFunction("foo_bar(X& x, Y& y)", 94, 96, ['template']),
        createCppFunction("main()", 98, 98, []),
    ]);
})
