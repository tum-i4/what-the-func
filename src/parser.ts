import Parser, {SyntaxNode, Tree} from "tree-sitter";

const Cpp = require("tree-sitter-cpp");

export type FunctionProperty = 'template' | 'macro' | 'static' | 'virtual' | 'override';

export type CppFunction = {
    name: string;
    className?: string;
    namespace?: string;
    start: number;
    end: number;
    properties: FunctionProperty[];
}

const FUNCTION_DECLARATION = "function_declarator";
const FUNCTION_DEFINITIONS = ["function_definition"];
const CLASS_DEFINITIONS = ["class_specifier", "struct_specifier"];
const CLASS_IDENTIFIER = "type_identifier";
const NAMESPACE_DEFINITION = "namespace_definition";
const NAMESPACE_IDENTIFIER = "identifier";

type DeclarationType = typeof CLASS_IDENTIFIER | typeof FUNCTION_DECLARATION | typeof NAMESPACE_IDENTIFIER;

const getIdentifierForDeclarationType: (node: SyntaxNode, type: DeclarationType) => string = (node, type) => {
    for (const child of node.namedChildren) {
        if (child.type === type) {
            return child.text;
        }
    }

    console.warn(`Could not find identifier for node at line ${node.startPosition.row}.`);
    // fall back to using node ID (will be entire body)
    return `anon-id-${node.startPosition.row}-${node.endPosition.row}`;
}
const getFunctionName: (functionNode: SyntaxNode) => string = (functionNode) => getIdentifierForDeclarationType(functionNode, FUNCTION_DECLARATION);
const getClassName: (classNode: SyntaxNode) => string = (classNode) => getIdentifierForDeclarationType(classNode, CLASS_IDENTIFIER);
const getNamespaceIdentifier: (namespaceNode: SyntaxNode) => string = (namespaceNode) => getIdentifierForDeclarationType(namespaceNode, NAMESPACE_IDENTIFIER);

const getParentClassName: (node: SyntaxNode) => string | undefined = (node) => {
    if (node.parent) {
        if (CLASS_DEFINITIONS.includes(node.parent.type)) {
            return getClassName(node.parent);  // we do not support nested classes/structs for now.
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

const extractFunctionProperties: (functionNode: SyntaxNode) => FunctionProperty[] = (node) => {
    return [];
}

const convertFunctionDefinitionNode: (node: SyntaxNode) => CppFunction = (node) => {
    const functionName = getFunctionName(node);
    const className = getParentClassName(node);
    const namespaces = getParentNamespaces(node, []);
    const namespace = namespaces.length > 0 ? namespaces.join("::") : undefined;
    const properties = extractFunctionProperties(node);

    return {
        name: functionName,
        start: node.startPosition.row,
        end: node.endPosition.row,
        className: className,
        namespace: namespace,
        properties: properties
    }
}

const collectFunctions: (tree: Tree) => CppFunction[] = (tree) => {
    return tree.rootNode.descendantsOfType(FUNCTION_DEFINITIONS)
        .map(convertFunctionDefinitionNode)
}

export const parseSourceCode: (code: string) => CppFunction[] = (code) => {
    const parser = new Parser();
    parser.setLanguage(Cpp);
    const tree = parser.parse(code);
    return collectFunctions(tree);
}
