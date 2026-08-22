"use strict";
/**
 * extension/src/extension.ts
 * Entry point for the PhantomPkg VS Code extension.
 *
 * Registers:
 *   - Command: "phantompkg.scanFile"  (Command Palette: "PhantomPkg: Scan File")
 *   - Auto-scan on save for .py files and requirements.txt
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const api_1 = require("./api");
const diagnostics_1 = require("./diagnostics");
const hoverProvider_1 = require("./hoverProvider");
const statusBar_1 = require("./statusBar");
// ─── Helpers ────────────────────────────────────────────────────────────────
function isTargetDocument(document) {
    return (document.languageId === "python" ||
        document.fileName.endsWith("requirements.txt"));
}
function fileTypeFor(document) {
    return document.fileName.endsWith("requirements.txt")
        ? "requirements"
        : "source";
}
// ─── Core scan pipeline ─────────────────────────────────────────────────────
async function runScan(document) {
    if (!isTargetDocument(document)) {
        return;
    }
    (0, statusBar_1.showScanning)();
    const content = document.getText();
    const fileType = fileTypeFor(document);
    const result = await (0, api_1.scanContent)(content, fileType);
    if (result === null) {
        // Backend unreachable / timed out / errored.
        (0, statusBar_1.showOffline)();
        (0, diagnostics_1.clearDiagnostics)(document.uri);
        (0, hoverProvider_1.clearFindings)(document.uri);
        // Clear decorations on all visible editors showing this document.
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document === document) {
                (0, diagnostics_1.clearDecorations)(editor);
            }
        }
        return;
    }
    const { findings } = result;
    (0, diagnostics_1.applyDiagnostics)(document, findings);
    (0, hoverProvider_1.updateFindings)(document.uri, findings);
    (0, statusBar_1.showResults)(findings);
    // Apply background highlight decorations to all visible editors for this document.
    for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document === document) {
            (0, diagnostics_1.applyDecorations)(editor, findings);
        }
    }
    if (findings.length > 0) {
        const dangerCount = findings.filter((f) => f.risk_level === "danger").length;
        const suspCount = findings.filter((f) => f.risk_level === "suspicious").length;
        const lowCount = findings.filter((f) => f.risk_level === "low_risk").length;
        const unknownCount = findings.filter((f) => f.risk_level === "unknown").length;
        const rel = vscode.workspace.asRelativePath(document.uri);
        if (dangerCount > 0 || suspCount > 0) {
            vscode.window.showWarningMessage(`PhantomPkg [${rel}]: 🔴 ${dangerCount} danger, 🟠 ${suspCount} medium — hover imports for details.`);
        }
        else {
            // Only low_risk / unknown — informational, no warning popup.
            vscode.window.showInformationMessage(`PhantomPkg [${rel}]: 🟡 ${lowCount} low-risk, ⚪ ${unknownCount} unknown flagged.`);
        }
    }
}
// ─── Activation ─────────────────────────────────────────────────────────────
function activate(context) {
    // Register the diagnostic collection so it gets disposed on deactivate.
    context.subscriptions.push((0, diagnostics_1.getDiagnosticCollection)());
    // Register hover provider for Python and plaintext (requirements.txt).
    const hoverProvider = (0, hoverProvider_1.createHoverProvider)();
    context.subscriptions.push(vscode.languages.registerHoverProvider([
        { language: "python", scheme: "file" },
        { language: "plaintext", scheme: "file" },
    ], hoverProvider));
    // Command: "PhantomPkg: Scan File"
    const scanCommand = vscode.commands.registerCommand("phantompkg.scanFile", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("PhantomPkg: No active editor — open a Python file first.");
            return;
        }
        await runScan(editor.document);
    });
    context.subscriptions.push(scanCommand);
    // Auto-scan on save.
    const onSave = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (isTargetDocument(document)) {
            await runScan(document);
        }
    });
    context.subscriptions.push(onSave);
    // Clean up diagnostics/findings/decorations when a file is closed.
    const onClose = vscode.workspace.onDidCloseTextDocument((document) => {
        (0, diagnostics_1.clearDiagnostics)(document.uri);
        (0, hoverProvider_1.clearFindings)(document.uri);
        // Decorations are tied to the editor, which is already gone on close — no-op needed.
    });
    context.subscriptions.push(onClose);
    console.log("[PhantomPkg] Extension activated.");
}
function deactivate() {
    (0, statusBar_1.disposeStatusBar)();
    console.log("[PhantomPkg] Extension deactivated.");
}
//# sourceMappingURL=extension.js.map