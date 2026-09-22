import * as vscode from "vscode";

export interface Finding {
  package: string;
  ecosystem: string;
  risk_level: "danger" | "suspicious" | "low_risk" | "unknown";
  reason: string;
  line: number;        
  start_column: number; 
  end_column: number;   
  description?: string;
}

export interface ScanResponse {
  status: "success" | "error";
  findings: Finding[];
}

const BACKEND_URLS = [
  "http://127.0.0.1:8000/api/scan",
  "https://phantompkg.onrender.com/api/scan",
];
const TIMEOUT_MS = 10_000;

export async function scanContent(
  content: string,
  language: string = "python",
  fileType: "source" | "requirements" = "source",
  whitelist: string[] = []
): Promise<ScanResponse | null> {
  const payload = JSON.stringify({
    language,
    file_type: fileType,
    content,
    whitelist,
  });

  for (const url of BACKEND_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(`[PhantomPkg] ${url} returned HTTP ${response.status}`);
        vscode.window.showErrorMessage(`PhantomPkg HTTP ${response.status} from ${url}`);
        continue;
      }

      const data = (await response.json()) as ScanResponse;
      if (data.status === "error") {
        console.error(`[PhantomPkg] ${url} responded with status=error`);
        continue;
      }
      return data;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.error(`[PhantomPkg] ${url} timed out after ${TIMEOUT_MS}ms`);
        vscode.window.showErrorMessage(`PhantomPkg: Timeout reaching ${url}`);
      } else {
        console.error(`[PhantomPkg] ${url} error:`, err);
        vscode.window.showErrorMessage(`PhantomPkg Error: ${err instanceof Error ? err.message : String(err)}`);
      }
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

