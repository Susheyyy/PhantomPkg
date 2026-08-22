/**
 * extension/src/api.ts
 * Calls the PhantomPkg FastAPI backend at http://127.0.0.1:8000/api/scan.
 * Returns null on any network/backend failure (caller handles gracefully).
 */

export interface Finding {
  package: string;
  ecosystem: string;
  risk_level: "danger" | "suspicious" | "low_risk" | "unknown";
  reason: string;
  line: number;        // 1-based (from ast.lineno)
  start_column: number; // 0-based (from ast.col_offset)
  end_column: number;   // 0-based, exclusive
}

export interface ScanResponse {
  status: "success" | "error";
  findings: Finding[];
}

const BACKEND_URL = "http://127.0.0.1:8000/api/scan";
const TIMEOUT_MS = 10_000;

export async function scanContent(
  content: string,
  fileType: "source" | "requirements" = "source",
  whitelist: string[] = []
): Promise<ScanResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "python",
        file_type: fileType,
        content,
        whitelist,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[PhantomPkg] Backend returned HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as ScanResponse;
    if (data.status === "error") {
      console.error("[PhantomPkg] Backend responded with status=error");
      return null;
    }
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[PhantomPkg] Request timed out after", TIMEOUT_MS, "ms");
    } else {
      console.error("[PhantomPkg] Network error:", err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

