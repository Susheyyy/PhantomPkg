import * as vscode from "vscode";
import { scanContent } from "./api";
import { applyDiagnostics, clearDiagnostics, getDiagnosticCollection, applyDecorations, clearDecorations } from "./diagnostics";
import { createHoverProvider, updateFindings, clearFindings } from "./hoverProvider";
import {
  showScanning,
  showResults,
  showOffline,
  disposeStatusBar,
} from "./statusBar";

function isTargetDocument(document: vscode.TextDocument): boolean {
  return (
    document.languageId === "python" ||
    document.languageId === "javascript" ||
    document.languageId === "typescript" ||
    document.languageId === "javascriptreact" ||
    document.languageId === "typescriptreact" ||
    document.fileName.endsWith("requirements.txt")
  );
}

function getLanguage(document: vscode.TextDocument): string {
  if (document.languageId.includes("javascript")) return "javascript";
  if (document.languageId.includes("typescript")) return "typescript";
  return "python";
}

function fileTypeFor(document: vscode.TextDocument): "source" | "requirements" {
  return document.fileName.endsWith("requirements.txt")
    ? "requirements"
    : "source";
}

async function readWhitelist(): Promise<string[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return [];
  }
  const fileUri = vscode.Uri.joinPath(folders[0].uri, ".phantompkgignore.json");
  try {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const parsed = JSON.parse(Buffer.from(raw).toString("utf8"));
    if (Array.isArray(parsed)) {
      return parsed.filter((e): e is string => typeof e === "string");
    }
    return [];
  } catch {
    return [];
  }
}

async function runScan(document: vscode.TextDocument): Promise<void> {
  if (!isTargetDocument(document)) {
    return;
  }

  showScanning();

  const content = document.getText();
  const language = getLanguage(document);
  const fileType = fileTypeFor(document);
  const whitelist = await readWhitelist();
  const result = await scanContent(content, language, fileType, whitelist);

  if (result === null) {
    showOffline();
    clearDiagnostics(document.uri);
    clearFindings(document.uri);
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document === document) {
        clearDecorations(editor);
      }
    }
    return;
  }

  const { findings } = result;

  applyDiagnostics(document, findings);
  updateFindings(document.uri, findings);
  showResults(findings);

  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document === document) {
      applyDecorations(editor, findings);
    }
  }

  if (findings.length > 0) {
    const dangerCount  = findings.filter((f) => f.risk_level === "danger").length;
    const suspCount    = findings.filter((f) => f.risk_level === "suspicious").length;
    const lowCount     = findings.filter((f) => f.risk_level === "low_risk").length;
    const unknownCount = findings.filter((f) => f.risk_level === "unknown").length;
    const rel = vscode.workspace.asRelativePath(document.uri);
    if (dangerCount > 0 || suspCount > 0) {
      vscode.window.showWarningMessage(
        `PhantomPkg [${rel}]: 🔴 ${dangerCount} danger, 🟠 ${suspCount} medium — hover imports for details.`
      );
    } else {
      vscode.window.showInformationMessage(
        `PhantomPkg [${rel}]: 🟡 ${lowCount} low-risk, ⚪ ${unknownCount} unknown flagged.`
      );
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(getDiagnosticCollection());

  const hoverProvider = createHoverProvider();
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      [
        { language: "python", scheme: "file" },
        { language: "javascript", scheme: "file" },
        { language: "typescript", scheme: "file" },
        { language: "javascriptreact", scheme: "file" },
        { language: "typescriptreact", scheme: "file" },
        { language: "plaintext", scheme: "file" },
      ],
      hoverProvider
    )
  );

  const scanCommand = vscode.commands.registerCommand(
    "phantompkg.scanFile",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage(
          "PhantomPkg: No active editor — open a Python file first."
        );
        return;
      }
      await runScan(editor.document);
    }
  );
  context.subscriptions.push(scanCommand);

  const onSave = vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (isTargetDocument(document)) {
      await runScan(document);
    }
  });
  context.subscriptions.push(onSave);

  const onClose = vscode.workspace.onDidCloseTextDocument((document) => {
    clearDiagnostics(document.uri);
    clearFindings(document.uri);
  });
  context.subscriptions.push(onClose);

  console.log("[PhantomPkg] Extension activated.");
}

export function deactivate(): void {
  disposeStatusBar();
  console.log("[PhantomPkg] Extension deactivated.");
}
