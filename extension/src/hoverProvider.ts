import * as vscode from "vscode";
import type { Finding } from "./api";

const _findingsMap = new Map<string, Finding[]>();

export function updateFindings(uri: vscode.Uri, findings: Finding[]): void {
  _findingsMap.set(uri.toString(), findings);
}

export function clearFindings(uri: vscode.Uri): void {
  _findingsMap.delete(uri.toString());
}

export function createHoverProvider(): vscode.HoverProvider {
  return {
    provideHover(
      document: vscode.TextDocument,
      position: vscode.Position
    ): vscode.Hover | undefined {
      const findings = _findingsMap.get(document.uri.toString());
      if (!findings || findings.length === 0) {
        return undefined;
      }

      for (const f of findings) {
        const line = Math.max(0, f.line - 1);
        if (position.line !== line) {
          continue;
        }
        if (
          position.character >= f.start_column &&
          position.character < f.end_column
        ) {
          const icon = riskIcon(f.risk_level);
          let mdText = `**${icon} PhantomPkg — \`${f.package}\`**\n\n`;
          if (f.description) {
            mdText += `*${f.description}*\n\n---\n\n`;
          }
          mdText += f.reason;
          const md = new vscode.MarkdownString(mdText);
          md.isTrusted = false;
          return new vscode.Hover(md);
        }
      }

      return undefined;
    },
  };
}

function riskIcon(risk: Finding["risk_level"]): string {
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
