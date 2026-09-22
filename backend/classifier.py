# coding: utf-8
"""
backend/classifier.py - Person C
Risk classification: combines parser + registry + similarity outputs.

Risk tiers (PROJECT_CONTEXT Section 4):
  danger     - registry 404 (package does not exist)
  suspicious - exists BUT age < 60 days OR similarity score > 85%
  low_risk   - exists, age >= 60 days, no similarity flag
  unknown    - registry call failed / timed out
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

AGE_THRESHOLD_DAYS: int = 60

RiskLevel = Literal["danger", "suspicious", "low_risk", "unknown"]


@dataclass
class ClassifiedFinding:
    package: str
    ecosystem: str
    risk_level: RiskLevel
    reason: str
    line: int
    start_column: int
    end_column: int
    description: str | None


def classify(
    *,
    package: str,
    ecosystem: str,
    exists: object,          # bool | None
    age_days: object,        # int | None
    is_similar: bool,
    best_match: object,      # str | None
    similarity_score: float,
    line: int,
    start_column: int,
    end_column: int,
    description: object,     # str | None
) -> ClassifiedFinding:
    """Apply PROJECT_CONTEXT Section 4 risk rules to produce a ClassifiedFinding."""

    # Tier: Unknown
    if exists is None:
        return ClassifiedFinding(
            package=package, ecosystem=ecosystem, risk_level="unknown",
            reason="Registry lookup failed or timed out. Could not verify package.",
            line=line, start_column=start_column, end_column=end_column,
            description=None,
        )

    # Tier: Danger
    if exists is False:
        return ClassifiedFinding(
            package=package, ecosystem=ecosystem, risk_level="danger",
            reason=(
                "Package does not exist in public registry "
                "(Possible hallucination/slopsquatting target)."
            ),
            line=line, start_column=start_column, end_column=end_column,
            description=None,
        )

    # Package exists - evaluate age + similarity
    suspicious_reasons: list[str] = []

    if age_days is not None and isinstance(age_days, int) and age_days < AGE_THRESHOLD_DAYS:
        suspicious_reasons.append(
            f"Package is only {age_days} day(s) old (threshold: {AGE_THRESHOLD_DAYS} days)."
        )

    if is_similar and best_match:
        suspicious_reasons.append(
            f"Name is {similarity_score:.1f}% similar to popular package "
            f"'{best_match}' (possible typosquat)."
        )

    # Tier: Suspicious
    if suspicious_reasons:
        return ClassifiedFinding(
            package=package, ecosystem=ecosystem, risk_level="suspicious",
            reason=" ".join(suspicious_reasons),
            line=line, start_column=start_column, end_column=end_column,
            description=description if isinstance(description, str) else None,
        )

    # Tier: Low Risk
    age_str = f"{age_days} days" if isinstance(age_days, int) else "> 60 days"
    return ClassifiedFinding(
        package=package, ecosystem=ecosystem, risk_level="low_risk",
        reason=f"Verified package. First published {age_str} ago.",
        line=line, start_column=start_column, end_column=end_column,
        description=description if isinstance(description, str) else None,
    )


def classify_batch(
    parsed_packages: list[dict],
    registry_results: list[dict],
    similarity_results: list,
) -> list[ClassifiedFinding]:
    """Zip parser, registry, and similarity outputs and classify each package."""
    findings: list[ClassifiedFinding] = []
    for pkg_info, reg, sim in zip(parsed_packages, registry_results, similarity_results):
        finding = classify(
            package=pkg_info["package"],
            ecosystem=pkg_info.get("ecosystem", "pypi"),
            exists=reg.get("exists"),
            age_days=reg.get("age_days"),
            is_similar=sim.is_suspicious,
            best_match=sim.best_match,
            similarity_score=sim.score,
            line=pkg_info["line"],
            start_column=pkg_info["start_column"],
            end_column=pkg_info["end_column"],
            description=reg.get("description"),
        )
        findings.append(finding)
    return findings
