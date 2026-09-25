# PhantomPkg: Slopsquatting Detector

PhantomPkg is a real-time, "shift-left" security tool that detects AI-hallucinated and typosquatted dependencies directly within the IDE *before* they can be executed or installed.

---

## Problem Statement
AI coding assistants (like ChatGPT, Copilot, and Claude) frequently hallucinate dependency package names. Attackers exploit this via **Slopsquatting**: they pre-register these hallucinated names on public registries (like PyPI and npm) and upload malware. When developers copy-paste AI-generated code and run `pip install` or `npm install`, malware is installed silently. Traditional vulnerability scanners only work *after* the package is locked or installed.

## Solution
PhantomPkg bridges this gap by acting as a real-time shield. It intercepts code at the keystroke level (`onSave`), extracts imports using language-specific syntax trees, and asynchronously verifies them against public registries. Developers are visually warned of hallucinated or malicious packages directly in VS Code before executing any terminal commands.

---

## Implemented Features & Modules

### 1. Intelligent Parsing Module (Python & JS/TS)
- Uses Python's built-in **Abstract Syntax Tree (AST)** to guarantee 0% false positives from comments or strings.
- Implements an **Import-to-Package mapping layer** to resolve aliases (e.g., `import cv2` -> `opencv-python`) and prevent false flags.

### 2. Multi-Factor Risk Classification Engine
Packages are dynamically classified into 4 actionable risk tiers:
- 🔴 **Danger:** Package does not exist (HTTP 404). Prime hallucination/slopsquatting target.
- 🟠 **Suspicious:** Package exists but is < 60 days old OR has > 85% string similarity to a popular seed package.
- 🟡 **Low Risk:** Established, safe packages.
- ⚪ **Unknown:** Network timeout or offline state (graceful degradation).

### 3. Asynchronous Backend Module
- Built with **FastAPI**, `asyncio`, and `httpx` to handle batch registry lookups in parallel.
- Integrates **RapidFuzz** for millisecond-level Levenshtein distance calculations (typosquatting detection) without freezing the IDE.

### 4. VS Code UI Integration
- Non-intrusive native API integration: Uses background highlights, `DiagnosticCollection` (squiggly lines), hover tooltips, and status bar metrics to prevent alert fatigue.

---

## Tech Stack
* **Client / Frontend:** VS Code Extension API, TypeScript, Node.js
* **Backend API:** Python 3.11+, FastAPI, Uvicorn
* **Algorithms & Networking:** `RapidFuzz` (String similarity), `httpx` (Async HTTP requests), Python `ast`
* **Ecosystems Supported:** PyPI (Python), npm (JavaScript/TypeScript)

---

## System Architecture

```mermaid
flowchart TD

    subgraph Client["1. VS CODE EXTENSION"]
        direction TB

        subgraph Inputs["Input Sources"]
            I1["Active Editor<br/>.py / .js / .ts"]
            I2["requirements.txt"]
            I3["package.json"]
        end

        subgraph Features["Extension Features"]
            F1["Manual Scan"]
            F2["Scan On Save"]
            F3["Diagnostics / Squiggles"]
            F4["Hover Provider & Status Bar"]
        end

        Inputs --> Features
    end

    subgraph Backend["2. FASTAPI BACKEND"]
        direction LR

        B1["Language & Ecosystem Detection"]
        B2["AST / Regex Package Extractor"]
        B3["Import-to-Distribution Mapping"]
        B4["Async Batch Lookup Engine"]
        B5["Multi-Signal Risk Scoring"]

        B1 --> B2
        B2 --> B3
        B3 --> B4
        B4 --> B5
    end

    subgraph Registries["3. EXTERNAL REGISTRIES"]
        direction TB

        R1["PyPI JSON API<br/>/pypi/{package}/json"]
        R2["npm Registry API<br/>/{package}"]
    end

    Client -->|"POST /api/scan"| Backend
    Backend -->|"JSON Findings"| Client

    B4 <-->|"Async HTTP Requests"| R1
    B4 <-->|"Async HTTP Requests"| R2
```
---

## Backend Process Flow & Risk Analysis

```mermaid
flowchart TD
    A["Input Received: Code / Manifest"] --> B["Language & Ecosystem Detection"]
    B --> C["Extract Package Names via AST / Regex"]
    C --> D["Apply Import Mapping Rules<br/><i>(e.g., cv2 → opencv-python)</i>"]
    D --> E["Deduplicate & Store Line/Col Offsets"]
    E --> F["Async Query to Registries<br/><i>(3s Timeout)</i>"]
    
    F --> G{"Package Status?"}
    
    G -->|"404 Not Found"| H["🔴 DANGER TIER<br/>Non-existent package<br/>(High hallucination risk)"]
    G -->|"200 OK"| I{"First Publish Date Check"}
    G -->|"Timeout / 5xx Error"| J["⚪ UNKNOWN TIER<br/>Could not verify via API"]
    
    I -->|"< 60 Days (Weighted)"| K["🟡 SUSPICIOUS TIER<br/>Recent publish / Risk signals"]
    I -->|"> 60 Days"| L["🟢 LOW RISK / ESTABLISHED<br/>Verified history"]
    
    H --> M["Aggregate & Sort Results by Severity"]
    K --> M
    L --> M
    J --> M
    
    M --> N["Return JSON Findings to VS Code"]
    
```
---

## Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js & npm

### Step 1: Start the Backend
Open a terminal and navigate to the backend folder:
```bash
cd backend
pip install -r requirements.txt
python main.py
```
*The API will start running at `http://127.0.0.1:8000`.*

### Step 2: Run the VS Code Extension
Open a new VS Code window and navigate to the extension folder:
```bash
cd extension
npm install
```
1. Open the `extension` folder in VS Code (`File` -> `Open Folder` -> `PhantomPkg/extension`).
2. Press **`F5`** (or go to Run -> Start Debugging).
3. Select **`npm: compile`** if prompted.
4. A new VS Code window labeled **`[Extension Development Host]`** will open.

### Step 3: Test It
In the new Extension Development Host window:
1. Create a new file and save it as `test.py`.
2. Paste some test imports (e.g., `import requests`, `import fake_ai_package_123`, `import reqeusts`).
3. Press `Ctrl+S`. You will instantly see the color-coded background highlights and hover tooltips!

---
