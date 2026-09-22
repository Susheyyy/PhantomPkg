const ts = require('typescript');
const fs = require('fs');

const stdinBuffer = fs.readFileSync(0); // read from stdin
const content = stdinBuffer.toString();

const sourceFile = ts.createSourceFile(
    "temp.ts",
    content,
    ts.ScriptTarget.Latest,
    true
);

const results = [];

function visit(node) {
    if (ts.isImportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            const raw = node.moduleSpecifier.text;
            const start = node.moduleSpecifier.getStart(sourceFile);
            const end = node.moduleSpecifier.getEnd();
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
            results.push({
                raw: raw,
                line: line + 1,
                start_column: character,
                end_column: character + (end - start)
            });
        }
    } else if (ts.isCallExpression(node)) {
        if (node.expression && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
            if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
                const raw = node.arguments[0].text;
                const start = node.arguments[0].getStart(sourceFile);
                const end = node.arguments[0].getEnd();
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
                results.push({
                    raw: raw,
                    line: line + 1,
                    start_column: character,
                    end_column: character + (end - start)
                });
            }
        }
    }
    // Dynamic imports
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
            const raw = node.arguments[0].text;
            const start = node.arguments[0].getStart(sourceFile);
            const end = node.arguments[0].getEnd();
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
            results.push({
                raw: raw,
                line: line + 1,
                start_column: character,
                end_column: character + (end - start)
            });
        }
    }
    ts.forEachChild(node, visit);
}

visit(sourceFile);
console.log(JSON.stringify(results));
