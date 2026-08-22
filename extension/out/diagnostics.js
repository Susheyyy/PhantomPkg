"use strict";
/**
 * extension/src/diagnostics.ts
 * Converts backend Finding[] into vscode.Diagnostic objects and manages the DiagnosticCollection.
 * Also applies TextEditorDecorationType background highlights per risk tier.
 *
 * Line indexing:
 *   - Backend returns line as 1-based (from Python ast.lineno).
 *   - VS Code Position uses 0-based lines.
 *   → We subtract 1 from line before constructing the Range.
 *
 * Column indexing:
 *   - Backend returns start_column/end_column as 0-based (from ast.col_offset).
 *   - VS Code Position uses 0-based characters.
 *   → Use as-is.
 *
 * Severity mapping (squiggles):
 *   danger      → DiagnosticSeverity.Error
 *   suspicious  → DiagnosticSeverity.Warning
 *   low_risk    → DiagnosticSeverity.Information
 *   unknown     → DiagnosticSeverity.Hint
 *
 * Background highlight colors:
 *   danger      → rgba(255, 0, 0, 0.18)      — red
 *   suspicious  → rgba(255, 140, 0, 0.18)    — orange  (displayed as "Medium" in UI)
 *   low_risk    → rgba(255, 230, 0, 0.15)    — yellow
 *   unknown     → rgba(255, 255, 255, 0.12)  — light gray (visible on dark + light themes)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiagnosticCollection = getDiagnosticCollection;
exports.applyDecorations = applyDecorations;
exports.clearDecorations = clearDecorations;
exports.applyDiagnostics = applyDiagnostics;
exports.clearDiagnostics = clearDiagnostics;
exports.clearAllDiagnostics = clearAllDiagnostics;
const vscode = __importStar(require("vscode"));
const COLLECTION_NAME = "phantompkg";
let _collection;
function getDiagnosticCollection() {
    if (!_collection) {
        _collection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
    }
    return _collection;
}
// ─── Decoration types (background highlights) ────────────────────────────────
const _decorations = {
    danger: vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 0, 0, 0.18)",
        borderRadius: "3px",
    }),
    suspicious: vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 140, 0, 0.18)",
        borderRadius: "3px",
    }),
    low_risk: vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 230, 0, 0.15)",
        borderRadius: "3px",
    }),
    unknown: vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        borderRadius: "3px",
    }),
};
function applyDecorations(editor, findings) {
    // Group findings by risk tier.
    const groups = {
        danger: [],
        suspicious: [],
        low_risk: [],
        unknown: [],
    };
    for (const f of findings) {
        const line = Math.max(0, f.line - 1);
        groups[f.risk_level].push(new vscode.Range(new vscode.Position(line, f.start_column), new vscode.Position(line, f.end_column)));
    }
    // Apply each decoration type (clears previous ranges for that type automatically).
    for (const tier of Object.keys(groups)) {
        editor.setDecorations(_decorations[tier], groups[tier]);
    }
}
function clearDecorations(editor) {
    for (const tier of Object.keys(_decorations)) {
        editor.setDecorations(_decorations[tier], []);
    }
}
function riskToSeverity(risk) {
    switch (risk) {
        case "danger":
            return vscode.DiagnosticSeverity.Error;
        case "suspicious":
            return vscode.DiagnosticSeverity.Warning;
        case "low_risk":
            return vscode.DiagnosticSeverity.Information;
        case "unknown":
            return vscode.DiagnosticSeverity.Hint;
    }
}
function applyDiagnostics(document, findings) {
    const collection = getDiagnosticCollection();
    const diagnostics = findings.map((f) => {
        // Backend line is 1-based; VS Code needs 0-based.
        const line = Math.max(0, f.line - 1);
        const startChar = f.start_column;
        const endChar = f.end_column;
        const range = new vscode.Range(new vscode.Position(line, startChar), new vscode.Position(line, endChar));
        const diag = new vscode.Diagnostic(range, f.reason, riskToSeverity(f.risk_level));
        diag.source = "PhantomPkg";
        diag.code = f.risk_level;
        return diag;
    });
    // Replace all previous diagnostics for this file atomically.
    collection.set(document.uri, diagnostics);
}
function clearDiagnostics(uri) {
    getDiagnosticCollection().delete(uri);
}
function clearAllDiagnostics() {
    getDiagnosticCollection().clear();
}
//# sourceMappingURL=diagnostics.js.map