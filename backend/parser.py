# coding: utf-8
"""
backend/parser.py - Person A
Extracts imported package names (with line/column metadata) from:
  - Python source files  (via ast.walk)
  - requirements.txt     (via regex)
  - JavaScript / TypeScript source files (via regex)

Returns a list of dicts:
  {
      "package":      str,   # distribution name (after import-to-dist mapping)
      "import_name":  str,   # raw name used in the source
      "ecosystem":    str,   # "pypi" | "npm"
      "line":         int,   # 1-based
      "start_column": int,   # 0-based, character offset of the package name
      "end_column":   int,   # 0-based, exclusive end
  }
"""

from __future__ import annotations

import ast
import re
from typing import TypedDict


class PackageInfo(TypedDict):
    package: str
    import_name: str
    ecosystem: str
    line: int
    start_column: int
    end_column: int


import json
from pathlib import Path

# Load Import-name -> PyPI distribution-name mapping from aliases.json
try:
    _aliases_path = Path(__file__).parent / "aliases.json"
    with _aliases_path.open("r", encoding="utf-8") as f:
        IMPORT_TO_DIST: dict[str, str] = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    IMPORT_TO_DIST: dict[str, str] = {}

_STDLIB: frozenset[str] = frozenset({
    "abc", "ast", "asyncio", "base64", "builtins", "cgi", "cgitb",
    "chunk", "cmath", "cmd", "code", "codecs", "codeop", "collections",
    "colorsys", "compileall", "concurrent", "configparser", "contextlib",
    "contextvars", "copy", "copyreg", "cProfile", "csv", "ctypes",
    "curses", "dataclasses", "datetime", "dbm", "decimal", "difflib",
    "dis", "distutils", "doctest", "email", "encodings", "enum",
    "errno", "faulthandler", "fcntl", "filecmp", "fileinput", "fnmatch",
    "fractions", "ftplib", "functools", "gc", "getopt", "getpass",
    "gettext", "glob", "grp", "gzip", "hashlib", "heapq", "hmac",
    "html", "http", "idlelib", "imaplib", "importlib", "inspect",
    "io", "ipaddress", "itertools", "json", "keyword", "lib2to3",
    "linecache", "locale", "logging", "lzma", "mailbox", "math",
    "mimetypes", "mmap", "modulefinder", "multiprocessing", "netrc",
    "nis", "nntplib", "numbers", "operator", "optparse", "os",
    "ossaudiodev", "pathlib", "pdb", "pickle", "pickletools", "pipes",
    "pkgutil", "platform", "plistlib", "poplib", "posix", "posixpath",
    "pprint", "profile", "pstats", "pty", "pwd", "py_compile",
    "pyclbr", "pydoc", "queue", "quopri", "random", "re", "readline",
    "reprlib", "rlcompleter", "runpy", "sched", "secrets", "select",
    "selectors", "shelve", "shlex", "shutil", "signal", "site",
    "smtpd", "smtplib", "sndhdr", "socket", "socketserver", "spwd",
    "sqlite3", "ssl", "stat", "statistics", "string", "stringprep",
    "struct", "subprocess", "sunau", "symtable", "sys", "sysconfig",
    "syslog", "tabnanny", "tarfile", "telnetlib", "tempfile", "termios",
    "test", "textwrap", "threading", "time", "timeit", "tkinter",
    "token", "tokenize", "tomllib", "trace", "traceback", "tracemalloc",
    "tty", "turtle", "turtledemo", "types", "typing", "unicodedata",
    "unittest", "urllib", "uu", "uuid", "venv", "warnings", "wave",
    "weakref", "webbrowser", "winreg", "winsound", "wsgiref", "xdrlib",
    "xml", "xmlrpc", "zipapp", "zipfile", "zipimport", "zlib",
    "zoneinfo", "__future__", "_thread", "antigravity", "this",
})


def _normalize_pypi(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def _resolve_dist(import_name: str) -> str:
    top = import_name.split(".")[0]
    resolved = IMPORT_TO_DIST.get(import_name) or IMPORT_TO_DIST.get(top) or top
    return _normalize_pypi(resolved)


def _is_stdlib(name: str) -> bool:
    return name.split(".")[0] in _STDLIB


def parse_python_source(content: str) -> list[PackageInfo]:
    """Parse Python source with ast.walk and return per-import metadata."""
    results: list[PackageInfo] = []
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return _parse_python_fallback(content)

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                raw = alias.name
                if _is_stdlib(raw):
                    continue
                dist = _resolve_dist(raw)
                start_col = node.col_offset + len("import ")
                end_col = start_col + len(raw)
                results.append(PackageInfo(
                    package=dist, import_name=raw, ecosystem="pypi",
                    line=node.lineno, start_column=start_col, end_column=end_col,
                ))
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if not module or _is_stdlib(module):
                continue
            dist = _resolve_dist(module)
            start_col = node.col_offset + len("from ")
            end_col = start_col + len(module)
            results.append(PackageInfo(
                package=dist, import_name=module, ecosystem="pypi",
                line=node.lineno, start_column=start_col, end_column=end_col,
            ))

    seen: set[tuple[str, int]] = set()
    unique: list[PackageInfo] = []
    for item in results:
        key = (item["package"], item["line"])
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def _parse_python_fallback(content: str) -> list[PackageInfo]:
    results: list[PackageInfo] = []
    import_re = re.compile(
        r"^(?:import\s+([\w.]+)|from\s+([\w.]+)\s+import\s+\S+)",
        re.MULTILINE,
    )
    for lineno, line in enumerate(content.splitlines(), start=1):
        m = import_re.match(line.strip())
        if not m:
            continue
        raw = m.group(1) or m.group(2)
        if not raw or _is_stdlib(raw):
            continue
        dist = _resolve_dist(raw)
        prefix = "import " if m.group(1) else "from "
        start_col = line.index(prefix) + len(prefix)
        end_col = start_col + len(raw)
        results.append(PackageInfo(
            package=dist, import_name=raw, ecosystem="pypi",
            line=lineno, start_column=start_col, end_column=end_col,
        ))
    return results


_REQ_LINE_RE = re.compile(
    r"^\s*(?P<pkg>[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?)"
    r"(?:\[[\w,\s]+\])?"
    r"(?:\s*(?:==|>=|<=|!=|~=|>|<)\s*[\w.*,+!]+)*"
    r"\s*(?:#.*)?\s*$"
)


def parse_requirements_txt(content: str) -> list[PackageInfo]:
    results: list[PackageInfo] = []
    for lineno, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        m = _REQ_LINE_RE.match(line)
        if not m:
            continue
        pkg = m.group("pkg")
        dist = _resolve_dist(pkg)
        start_col = raw_line.index(pkg)
        end_col = start_col + len(pkg)
        results.append(PackageInfo(
            package=dist, import_name=pkg, ecosystem="pypi",
            line=lineno, start_column=start_col, end_column=end_col,
        ))
    return results


_JS_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:[\w*{},\s]+\s+from\s+)?['"](?P<esm>[^'"./][^'"]*)['"\s])|"""
    r"""(?:require\s*\(\s*['"](?P<cjs>[^'"./][^'"]*)['"\s]\s*\))""",
    re.MULTILINE,
)

_NODE_STDLIB: frozenset[str] = frozenset({
    "assert", "async_hooks", "buffer", "child_process", "cluster",
    "console", "constants", "crypto", "dgram", "diagnostics_channel",
    "dns", "domain", "events", "fs", "http", "http2", "https",
    "inspector", "module", "net", "os", "path", "perf_hooks", "process",
    "punycode", "querystring", "readline", "repl", "stream",
    "string_decoder", "sys", "timers", "tls", "trace_events", "tty",
    "url", "util", "v8", "vm", "wasi", "worker_threads", "zlib",
})


import subprocess
import json
from pathlib import Path

def parse_js_source(content: str) -> list[PackageInfo]:
    results: list[PackageInfo] = []
    script_path = Path(__file__).parent / "parse_ts.js"
    try:
        proc = subprocess.run(
            ["node", str(script_path)],
            input=content,
            text=True,
            capture_output=True,
            check=True
        )
        extracted = json.loads(proc.stdout)
    except Exception:
        return []

    for item in extracted:
        raw = item.get("raw")
        if not raw:
            continue
        if raw.startswith("@"):
            parts = raw.split("/")
            pkg = "/".join(parts[:2]) if len(parts) >= 2 else raw
        else:
            pkg = raw.split("/")[0]
        if pkg in _NODE_STDLIB:
            continue
        results.append(PackageInfo(
            package=pkg, import_name=raw, ecosystem="npm",
            line=item["line"], start_column=item["start_column"], end_column=item["end_column"],
        ))
    return results


def parse(content: str, language: str, file_type: str) -> list[PackageInfo]:
    """
    Public entry point.
    language  : "python" | "javascript" | "typescript"
    file_type : "source" | "requirements"
    """
    if file_type == "requirements":
        return parse_requirements_txt(content)
    if language == "python":
        return parse_python_source(content)
    if language in ("javascript", "typescript"):
        return parse_js_source(content)
    return []
