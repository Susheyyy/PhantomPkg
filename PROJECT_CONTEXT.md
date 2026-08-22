# PROJECT CONTEXT — Slopsquatting Detector (VS Code Extension + FastAPI)
RevengersHack 2026 | Cybersecurity Track

---

## 1. Problem Statement
AI coding assistants (ChatGPT, Copilot, Claude) frequently hallucinate dependency package names.
Attackers exploit this via **Slopsquatting**: pre-registering hallucinated names on public registries
(PyPI, npm) and uploading malware. When developers copy-paste AI code and run `pip install`, malware
installs silently. Mainstream vulnerability scanners (Snyk, Dependabot) do not detect non-existent
or suspicious recently registered packages prior to installation.

---

## 2. Target Architecture
- **Client**: VS Code Extension (TypeScript) handling user workspace UI.
- **Backend**: FastAPI (Python 3.11+) running locally (`http://127.0.0.1:8000`).
- **External Registries**: PyPI JSON API & npm Registry API.

---

## 3. Strict API Contract

### Request: POST /api/scan
```json
{
  "language": "python",
  "file_type": "source",
  "content": "import requests\nimport non_existent_lib_123"
}
```

### Response:
```json
{
  "status": "success",
  "findings": [
    {
      "package": "requests",
      "ecosystem": "pypi",
      "risk_level": "low_risk",
      "reason": "Verified package. First published > 60 days ago.",
      "line": 1,
      "start_column": 7,
      "end_column": 15
    },
    {
      "package": "non_existent_lib_123",
      "ecosystem": "pypi",
      "risk_level": "danger",
      "reason": "Package does not exist in public registry (Possible hallucination/slopsquatting target).",
      "line": 2,
      "start_column": 7,
      "end_column": 27
    }
  ]
}
```

---

## 4. Risk Tiers & Scoring Logic

1. **Danger (Red)**: HTTP 404 from registry (Package does not exist).
2. **Suspicious (Yellow)**: Package exists (HTTP 200) BUT published < 60 days ago OR name similarity > 85% to a popular package.
3. **Low Risk (Green)**: Package exists, established > 60 days, no similarity flag.
4. **Unknown (Gray)**: API Request failed/timed out (Timeout set to 3s).

---

## 5. Team Role Division & File Ownership

| Person | Role | Files |
|--------|------|-------|
| Person A | Parser | backend/parser.py (AST Python parser + JS regex + Import-to-Package mapping) |
| Person B | Registry & Scoring | backend/registry.py, backend/similarity.py (Async PyPI/npm lookups, age check, RapidFuzz) |
| Person C | Backend & Classifier | backend/main.py, backend/classifier.py (FastAPI app, CORS, risk calculation, API contract) |
| Person D | VS Code UI | extension/src/* (extension.ts, diagnostics.ts, hoverProvider.ts, statusBar.ts, api.ts) |
