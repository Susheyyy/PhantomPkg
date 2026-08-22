"use strict";
/**
 * extension/src/hoverProvider.ts
 * Shows the `reason` string as a hover tooltip over the flagged import range.
 *
 * Strategy: on each scan we rebuild a map of (line, startChar) → Finding so
 * the hover provider can look up whether the hovered position falls inside a
 * flagged range without keeping a reference to the DiagnosticCollection.
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
exports.updateFindings = updateFindings;
exports.clearFindings = clearFindings;
exports.createHoverProvider = createHoverProvider;
const vscode = __importStar(require("vscode"));
/** Keyed by document URI string → array of findings for that file. */
const _findingsMap = new Map();
function updateFindings(uri, findings) {
    _findingsMap.set(uri.toString(), findings);
}
function clearFindings(uri) {
    _findingsMap.delete(uri.toString());
}
function createHoverProvider() {
    return {
        provideHover(document, position) {
            const findings = _findingsMap.get(document.uri.toString());
            if (!findings || findings.length === 0) {
                return undefined;
            }
            for (const f of findings) {
                // Backend line is 1-based; convert to 0-based for VS Code.
                const line = Math.max(0, f.line - 1);
                if (position.line !== line) {
                    continue;
                }
                if (position.character >= f.start_column &&
                    position.character < f.end_column) {
                    const icon = riskIcon(f.risk_level);
                    const md = new vscode.MarkdownString(`**${icon} PhantomPkg — \`${f.package}\`**\n\n${f.reason}`);
                    md.isTrusted = false;
                    return new vscode.Hover(md);
                }
            }
            return undefined;
        },
    };
}
function riskIcon(risk) {
    switch (risk) {
        case "danger":
            return "🔴";
        case "suspicious":
            return "🟡";
        case "low_risk":
            return "✅";
        case "unknown":
            return "❓";
    }
}
//# sourceMappingURL=hoverProvider.js.map