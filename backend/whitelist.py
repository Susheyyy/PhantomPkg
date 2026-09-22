from __future__ import annotations

import re


def normalize_for_compare(name: str) -> str:
    return re.sub(r"[-_. ]+", "-", name).lower()


def build_whitelist_set(entries: list[str]) -> set[str]:
    return {normalize_for_compare(e) for e in entries}


def filter_whitelisted(packages: list[dict], whitelist_set: set[str]) -> list[dict]:
    if not whitelist_set:
        return packages
    return [p for p in packages if normalize_for_compare(p["package"]) not in whitelist_set]
