import Parser, {SyntaxNode, Tree} from "tree-sitter";

const Cpp = require("tree-sitter-cpp");

const TEMPLATE_KEYWORD = 'template';
const MACRO_KEYWORD = 'macro';
const STATIC_KEYWORD = 'static';
const VIRTUAL_KEYWORD = 'virtual';
const OVERRIDE_KEYWORD = 'override';
const VOLATILE_KEYWORD = 'volatile';
const CONST_KEYWORD = 'const';

export type FunctionProperty =
    typeof TEMPLATE_KEYWORD
    | typeof MACRO_KEYWORD
    | typeof STATIC_KEYWORD
    | typeof VIRTUAL_KEYWORD
    | typeof OVERRIDE_KEYWORD
    | typeof VOLATILE_KEYWORD
    | typeof CONST_KEYWORD;

export type CppFunction = {
    name: string;
    className?: string;
    namespace?: string;
    start: number;
    end: number;
    properties: FunctionProperty[];
}

const REFERENCE_DECLARATOR = "reference_declarator";  // &
const FUNCTION_DECLARATION = "function_declarator";
const FUNCTION_DEFINITION = "function_definition";
const MACRO_FUNCTION_DEFINITION = "preproc_function_def";
const MACRO_FUNCTION_IDENTIFIER = "identifier";
const CLASS_DEFINITIONS = ["class_specifier", "struct_specifier"];
const CLASS_IDENTIFIER = "type_identifier";
const NAMESPACE_DEFINITION = "namespace_definition";
const NAMESPACE_IDENTIFIER = "identifier";
const TEMPLATE_DECLARATION = "template_declaration";
const TEMPLATE_SPECIALIZATION = "template_type";  // template<> struct A<int> => A<int>
const STATIC_SPECIFIER = "storage_class_specifier";
const VIRTUAL_SPECIFIER = "virtual_function_specifier";

type DeclarationType =
    typeof CLASS_IDENTIFIER
    | typeof FUNCTION_DECLARATION
    | typeof NAMESPACE_IDENTIFIER
    | typeof MACRO_FUNCTION_IDENTIFIER
    | typeof REFERENCE_DECLARATOR
    | typeof TEMPLATE_SPECIALIZATION;

const getIdentifierForDeclarationType: (node: SyntaxNode, type: DeclarationType, fallback?: (node: SyntaxNode) => string) => string = (node, type, fallback = undefined) => {
    for (const child of node.namedChildren) {
        if (child.type === type) {
            return child.text
                .replace('\n', ' ')
                .replace('\t', ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }
    }

    if (fallback) {
        return fallback(node);
    }

    // Fall back to using anonymous node identifier (adjust position to be 1-indexed).
    return `anon-id-${node.startPosition.row + 1}-${node.endPosition.row + 1}`;
}
const getFunctionName: (functionNode: SyntaxNode) => string = (functionNode) => getIdentifierForDeclarationType(functionNode, FUNCTION_DECLARATION, (node) => {
    // In case we don't find a function identifier, it might be entangled with the reference return type.
    // For instance, `const auto& foo() {}` or `Foo& operator++() {}` will result in a reference declarator `& foo()` or `& operator++()`.
    return getIdentifierForDeclarationType(node, REFERENCE_DECLARATOR);
});
const getClassName: (classNode: SyntaxNode) => string = (classNode) => getIdentifierForDeclarationType(classNode, CLASS_IDENTIFIER, (node) => {
    // In case we don't find a struct/class identifier, it could be, that the identifier is actually part of the template type definition.
    // For instance, `template<> class A<int> {}` will only have a template type `A<int>` defined.
    return getIdentifierForDeclarationType(node, TEMPLATE_SPECIALIZATION);
});
const getMacroFunctionName: (macroFunctionNode: SyntaxNode) => string = (macroFunctionNode) => getIdentifierForDeclarationType(macroFunctionNode, MACRO_FUNCTION_IDENTIFIER);
const getNamespaceIdentifier: (namespaceNode: SyntaxNode) => string = (namespaceNode) => getIdentifierForDeclarationType(namespaceNode, NAMESPACE_IDENTIFIER);

const getParentClassName: (node: SyntaxNode) => string | undefined = (node) => {
    if (node.parent) {
        if (CLASS_DEFINITIONS.includes(node.parent.type)) {
            return getClassName(node.parent);  // For nested types, we only use the direct parent.
        }
        return getParentClassName(node.parent);
    }
    return undefined;
}

const getParentNamespaces: (node: SyntaxNode, namespaces: string[]) => string[] = (node, namespaces) => {
    if (node.parent) {
        if (node.parent.type === NAMESPACE_DEFINITION) {
            namespaces.push(getNamespaceIdentifier(node.parent));
        }
        return getParentNamespaces(node.parent, namespaces);
    }
    return namespaces;
}

const extractAdditionalFunctionProperties: (functionNode: SyntaxNode) => FunctionProperty[] = (functionNode) => {
    const properties: FunctionProperty[] = [];
    // Check for template functions.
    if (functionNode.parent) {
        if (functionNode.parent.type === TEMPLATE_DECLARATION) {
            properties.push(TEMPLATE_KEYWORD);
        }
    }
    // Check for function specifiers in children.
    for (const child of functionNode.namedChildren) {
        if (child.type === STATIC_SPECIFIER && child.text === STATIC_KEYWORD) {
            properties.push(STATIC_KEYWORD);
        }
        if (child.type === VIRTUAL_SPECIFIER && child.text === VIRTUAL_KEYWORD) {
            properties.push(VIRTUAL_KEYWORD);
        }
    }
    return properties;
}

const convertFunctionDefinitionNode: (node: SyntaxNode) => CppFunction = (node) => {
    let functionName: string;
    let className = undefined;
    let namespace = undefined;
    let start = node.startPosition.row + 1;  // we want 1-indexed positions
    let end = node.endPosition.row + 1;  // we want 1-indexed positions
    let properties: FunctionProperty[] = [];
    if (node.type === MACRO_FUNCTION_DEFINITION) {
        functionName = getMacroFunctionName(node);
        properties.push(MACRO_KEYWORD);
        // Macro functions will always end at the next detected symbol.
        // Therefore, we exclude the line of the next symbol.
        end -= 1;
    } else {
        functionName = getFunctionName(node);
        className = getParentClassName(node);
        const namespaces = getParentNamespaces(node, []);
        namespace = namespaces.length > 0 ? namespaces.join("::") : undefined;
        // Extract keywords from function name into properties.
        const replaceKeywordFromName = (keyword: FunctionProperty) => {
            if (functionName.includes(` ${keyword}`)) {
                functionName = functionName
                    .replace(` ${keyword}`, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                properties.push(keyword);
            }
        };
        replaceKeywordFromName(OVERRIDE_KEYWORD);
        replaceKeywordFromName(VOLATILE_KEYWORD);
        replaceKeywordFromName(CONST_KEYWORD);
        properties = properties.concat(extractAdditionalFunctionProperties(node));
    }

    return {
        name: functionName,
        start: start,
        end: end,
        className: className,
        namespace: namespace,
        properties: properties
    }
}

const collectFunctions: (tree: Tree) => CppFunction[] = (tree) => {
    return tree.rootNode.descendantsOfType([FUNCTION_DEFINITION, MACRO_FUNCTION_DEFINITION])
        .map(convertFunctionDefinitionNode)
}

export const parseSourceCode: (code: string) => CppFunction[] = (code) => {
    const parser = new Parser();
    parser.setLanguage(Cpp);
    const tree = parser.parse(code);
    return collectFunctions(tree);
}
