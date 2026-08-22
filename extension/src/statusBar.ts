/**
 * extension/src/statusBar.ts
 * Manages the PhantomPkg status bar item (bottom-left of VS Code).
 *
 * States:
 *   scanning  → "$(sync~spin) PhantomPkg: Scanning..."
 *   results   → "🔴 N  🟠 N  🟡 N  ⚪ N"  (all 4 tiers always shown)
 *   offline   → "⚠️ Scanner Offline"
 */

import * as vscode from "vscode";
import type { Finding } from "./api";

let _item: vscode.StatusBarItem | undefined;

function getItem(): vscode.StatusBarItem {
  if (!_item) {
    _item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    _item.name = "PhantomPkg";
    _item.command = "phantompkg.scanFile";
    _item.tooltip = "Click to run PhantomPkg scan";
  }
  return _item;
}

export function showScanning(): void {
  const item = getItem();
  item.text = "$(sync~spin) PhantomPkg: Scanning...";
  item.backgroundColor = undefined;
  item.show();
}

export function showResults(findings: Finding[]): void {
  const item = getItem();

  const dangerCount    = findings.filter((f) => f.risk_level === "danger").length;
  const suspCount      = findings.filter((f) => f.risk_level === "suspicious").length;
  const lowRiskCount   = findings.filter((f) => f.risk_level === "low_risk").length;
  const unknownCount   = findings.filter((f) => f.risk_level === "unknown").length;

  if (findings.length === 0) {
    item.text = "$(shield) PhantomPkg: No imports found";
    item.backgroundColor = undefined;
  } else {
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

export function showOffline(): void {
  const item = getItem();
  item.text = "⚠️ PhantomPkg: Scanner Offline";
  item.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.warningBackground"
  );
  item.show();
}

export function hideStatusBar(): void {
  _item?.hide();
}

export function disposeStatusBar(): void {
  _item?.dispose();
  _item = undefined;
}
