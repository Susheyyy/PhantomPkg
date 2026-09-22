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

import * as vscode from "vscode";
import type { Finding } from "./api";

const COLLECTION_NAME = "phantompkg";

let _collection: vscode.DiagnosticCollection | undefined;

export function getDiagnosticCollection(): vscode.DiagnosticCollection {
  if (!_collection) {
    _collection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
  }
  return _collection;
}

const _decorations: Record<Finding["risk_level"], vscode.TextEditorDecorationType> = {
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

export function applyDecorations(
  editor: vscode.TextEditor,
  findings: Finding[]
): void {

  const groups: Record<Finding["risk_level"], vscode.Range[]> = {
    danger: [],
    suspicious: [],
    low_risk: [],
    unknown: [],
  };

  for (const f of findings) {
    const line = Math.max(0, f.line - 1);
    groups[f.risk_level].push(
      new vscode.Range(
        new vscode.Position(line, f.start_column),
        new vscode.Position(line, f.end_column)
      )
    );
  }

  for (const tier of Object.keys(groups) as Finding["risk_level"][]) {
    editor.setDecorations(_decorations[tier], groups[tier]);
  }
}

export function clearDecorations(editor: vscode.TextEditor): void {
  for (const tier of Object.keys(_decorations) as Finding["risk_level"][]) {
    editor.setDecorations(_decorations[tier], []);
  }
}

function riskToSeverity(
  risk: Finding["risk_level"]
): vscode.DiagnosticSeverity {
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

export function applyDiagnostics(
  document: vscode.TextDocument,
  findings: Finding[]
): void {
  const collection = getDiagnosticCollection();

  const diagnostics: vscode.Diagnostic[] = findings.map((f) => {
    const line = Math.max(0, f.line - 1);
    const startChar = f.start_column;
    const endChar = f.end_column;

    const range = new vscode.Range(
      new vscode.Position(line, startChar),
      new vscode.Position(line, endChar)
    );

    const diag = new vscode.Diagnostic(range, f.reason, riskToSeverity(f.risk_level));
    diag.source = "PhantomPkg";
    diag.code = f.risk_level;

    return diag;
  });

  collection.set(document.uri, diagnostics);
}

export function clearDiagnostics(uri: vscode.Uri): void {
  getDiagnosticCollection().delete(uri);
}

export function clearAllDiagnostics(): void {
  getDiagnosticCollection().clear();
}
