# coding: utf-8
"""
backend/main.py - Person C
FastAPI application - live classification pipeline.

Pipeline per POST /api/scan:
  1. parser.parse()                     (Person A)
  2. registry.batch_lookup()            (Person B)  [async]
  3. similarity.batch_check_similarity()(Person B)
  4. classifier.classify_batch()        (Person C)
  5. Return ScanResponse JSON
"""

from __future__ import annotations

from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from parser import parse
from registry import batch_lookup
from similarity import batch_check_similarity
from classifier import classify_batch
from whitelist import build_whitelist_set, filter_whitelisted

app = FastAPI(
    title="PhantomPkg - Slopsquatting Detector",
    description=(
        "Detects hallucinated / slopsquatted dependency names in source files "
        "by cross-referencing PyPI and npm registries."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScanRequest(BaseModel):
    language: Literal["python", "javascript", "typescript"] = "python"
    file_type: Literal["source", "requirements"] = "source"
    content: str
    whitelist: list[str] = []


class Finding(BaseModel):
    package: str
    ecosystem: str
    risk_level: Literal["danger", "suspicious", "low_risk", "unknown"]
    reason: str
    line: int
    start_column: int
    end_column: int
    description: str | None = None


class ScanResponse(BaseModel):
    status: Literal["success", "error"]
    findings: list[Finding]


@app.post(
    "/api/scan",
    response_model=ScanResponse,
    summary="Scan source content for risky / hallucinated packages",
)
async def scan(request: ScanRequest) -> ScanResponse:
    """
    Full classification pipeline:
      1. Parse content to extract package names + source positions.
      2. Async batch-lookup each package in PyPI / npm.
      3. Fuzzy-match each name against popular-package seed list.
      4. Classify each package into a risk tier.
      5. Return findings matching the PROJECT_CONTEXT Section 3 schema.
    """
    # Step 1: Parse
    parsed: list[dict] = parse(
        content=request.content,
        language=request.language,
        file_type=request.file_type,
    )
    if not parsed:
        return ScanResponse(status="success", findings=[])

    whitelist_set = build_whitelist_set(request.whitelist)
    parsed = filter_whitelisted(parsed, whitelist_set)
    if not parsed:
        return ScanResponse(status="success", findings=[])

    # Step 2: Registry lookups (async, parallel)
    registry_results: list[dict] = [
        dict(r) for r in await batch_lookup(parsed)
    ]

    # Step 3: Similarity checks (sync, in-process)
    similarity_results = batch_check_similarity(parsed)

    # Step 4: Classify
    classified = classify_batch(parsed, registry_results, similarity_results)

    # Step 5: Build response
    findings = [
        Finding(
            package=f.package,
            ecosystem=f.ecosystem,
            risk_level=f.risk_level,
            reason=f.reason,
            line=f.line,
            start_column=f.start_column,
            end_column=f.end_column,
            description=f.description,
        )
        for f in classified
    ]
    return ScanResponse(status="success", findings=findings)


@app.get("/health", summary="Server health check")
async def health() -> dict:
    return {"status": "ok", "service": "phantompkg-backend"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
