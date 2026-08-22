"use strict";
/**
 * extension/src/statusBar.ts
 * Manages the PhantomPkg status bar item (bottom-left of VS Code).
 *
 * States:
 *   scanning  → "$(sync~spin) PhantomPkg: Scanning..."
 *   results   → "🔴 N  🟠 N  🟡 N  ⚪ N"  (all 4 tiers always shown)
 *   offline   → "⚠️ Scanner Offline"
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
exports.showScanning = showScanning;
exports.showResults = showResults;
exports.showOffline = showOffline;
exports.hideStatusBar = hideStatusBar;
exports.disposeStatusBar = disposeStatusBar;
const vscode = __importStar(require("vscode"));
let _item;
function getItem() {
    if (!_item) {
        _item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        _item.name = "PhantomPkg";
        _item.command = "phantompkg.scanFile";
        _item.tooltip = "Click to run PhantomPkg scan";
    }
    return _item;
}
function showScanning() {
    const item = getItem();
    item.text = "$(sync~spin) PhantomPkg: Scanning...";
    item.backgroundColor = undefined;
    item.show();
}
function showResults(findings) {
    const item = getItem();
    const dangerCount = findings.filter((f) => f.risk_level === "danger").length;
    const suspCount = findings.filter((f) => f.risk_level === "suspicious").length;
    const lowRiskCount = findings.filter((f) => f.risk_level === "low_risk").length;
    const unknownCount = findings.filter((f) => f.risk_level === "unknown").length;
    if (findings.length === 0) {
        item.text = "$(shield) PhantomPkg: No imports found";
        item.backgroundColor = undefined;
    }
    else {
        // Always show all 4 counts for instant visual overview.
        item.text = `$(shield) 🔴 ${dangerCount}  🟠 ${suspCount}  🟡 ${lowRiskCount}  ⚪ ${unknownCount}`;
        item.backgroundColor =
            dangerCount > 0
                ? new vscode.ThemeColor("statusBarItem.errorBackground")
                : suspCount > 0
                    ? new vscode.ThemeColor("statusBarItem.warningBackground")
                    : undefined;
    }
    item.show();
}
function showOffline() {
    const item = getItem();
    item.text = "⚠️ PhantomPkg: Scanner Offline";
    item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    item.show();
}
function hideStatusBar() {
    _item?.hide();
}
function disposeStatusBar() {
    _item?.dispose();
    _item = undefined;
}
//# sourceMappingURL=statusBar.js.map