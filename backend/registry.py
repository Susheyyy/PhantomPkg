# coding: utf-8
"""
backend/registry.py - Person B
Async batch lookups against PyPI and npm registries.

Each result dict:
  {
      "package":       str,
      "ecosystem":     str,   # "pypi" | "npm"
      "exists":        bool | None,   # True=200, False=404, None=error
      "age_days":      int  | None,
      "first_release": str  | None,
  }
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import TypedDict

import httpx

TIMEOUT_SECONDS: float = 3.0
PYPI_BASE = "https://pypi.org/pypi/{pkg}/json"
NPM_BASE  = "https://registry.npmjs.org/{pkg}"


class RegistryResult(TypedDict):
    package: str
    ecosystem: str
    exists: object   # bool | None
    age_days: object  # int | None
    first_release: object  # str | None


def _age_days(iso_date: str) -> int:
    clean = iso_date[:19]
    try:
        dt = datetime.fromisoformat(clean).replace(tzinfo=timezone.utc)
    except ValueError:
        dt = datetime.fromisoformat(iso_date[:10]).replace(tzinfo=timezone.utc)
    now = datetime.now(tz=timezone.utc)
    return max(0, (now - dt).days)


async def _lookup_pypi(client: httpx.AsyncClient, package: str) -> RegistryResult:
    url = PYPI_BASE.format(pkg=package)
    try:
        resp = await client.get(url)
    except (httpx.TimeoutException, httpx.RequestError):
        return RegistryResult(package=package, ecosystem="pypi",
                              exists=None, age_days=None, first_release=None)

    if resp.status_code == 404:
        return RegistryResult(package=package, ecosystem="pypi",
                              exists=False, age_days=None, first_release=None)

    if resp.status_code != 200:
        return RegistryResult(package=package, ecosystem="pypi",
                              exists=None, age_days=None, first_release=None)

    try:
        data = resp.json()
        releases: dict = data.get("releases", {})
        all_times: list[str] = []
        for version_files in releases.values():
            for file_info in version_files:
                t = file_info.get("upload_time_iso_8601") or file_info.get("upload_time")
                if t:
                    all_times.append(t)
        if all_times:
            earliest = min(all_times)
            age = _age_days(earliest)
        else:
            earliest = None
            age = None
    except Exception:
        earliest = None
        age = None

    return RegistryResult(package=package, ecosystem="pypi",
                          exists=True, age_days=age, first_release=earliest)


async def _lookup_npm(client: httpx.AsyncClient, package: str) -> RegistryResult:
    url = NPM_BASE.format(pkg=package)
    try:
        resp = await client.get(url)
    except (httpx.TimeoutException, httpx.RequestError):
        return RegistryResult(package=package, ecosystem="npm",
                              exists=None, age_days=None, first_release=None)

    if resp.status_code == 404:
        return RegistryResult(package=package, ecosystem="npm",
                              exists=False, age_days=None, first_release=None)

    if resp.status_code != 200:
        return RegistryResult(package=package, ecosystem="npm",
                              exists=None, age_days=None, first_release=None)

    try:
        data = resp.json()
        time_obj: dict = data.get("time", {})
        created: str | None = time_obj.get("created")
        age = _age_days(created) if created else None
    except Exception:
        created = None
        age = None

    return RegistryResult(package=package, ecosystem="npm",
                          exists=True, age_days=age, first_release=created)


async def batch_lookup(
    packages: list[dict],
) -> list[RegistryResult]:
    """
    Fire all registry requests concurrently.
    packages: list of {"package": str, "ecosystem": str, ...}
    """
    timeout = httpx.Timeout(TIMEOUT_SECONDS, connect=TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        tasks = []
        for pkg_info in packages:
            ecosystem = pkg_info.get("ecosystem", "pypi")
            name = pkg_info["package"]
            if ecosystem == "npm":
                tasks.append(_lookup_npm(client, name))
            else:
                tasks.append(_lookup_pypi(client, name))
        results = await asyncio.gather(*tasks, return_exceptions=False)
    return list(results)
