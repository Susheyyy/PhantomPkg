# coding: utf-8
"""
backend/similarity.py - Person B
Fuzzy-match package names against a seed list of popular packages.
Score > 85% (and name != exact match) => suspicious.
"""

from __future__ import annotations

from dataclasses import dataclass

from rapidfuzz import fuzz, process

SIMILARITY_THRESHOLD: float = 85.0

POPULAR_PYPI: list[str] = [
    "requests", "numpy", "pandas", "scipy", "matplotlib", "seaborn",
    "scikit-learn", "tensorflow", "torch", "keras", "Pillow",
    "opencv-python", "flask", "Django", "fastapi", "starlette", "uvicorn",
    "sqlalchemy", "pymongo", "redis", "celery", "aiohttp", "httpx",
    "boto3", "google-cloud-storage", "google-auth", "azure-storage-blob",
    "paramiko", "cryptography", "pyOpenSSL", "PyJWT", "bcrypt",
    "pydantic", "attrs", "click", "typer", "rich", "tqdm",
    "pytest", "black", "flake8", "mypy", "isort", "pylint",
    "setuptools", "wheel", "pip", "virtualenv", "pipenv", "poetry",
    "PyYAML", "toml", "python-dotenv", "Jinja2", "MarkupSafe",
    "beautifulsoup4", "lxml", "html5lib", "scrapy",
    "psycopg2-binary", "PyMySQL", "motor", "databases",
    "alembic", "peewee", "tortoise-orm",
    "python-dateutil", "arrow", "pendulum",
    "chardet", "certifi", "idna", "urllib3",
    "six", "future", "typing-extensions", "importlib-metadata",
    "Werkzeug", "itsdangerous", "blinker",
    "loguru", "structlog",
    "dask", "polars", "pyarrow", "openpyxl", "xlrd",
    "sympy", "statsmodels",
    "nltk", "spacy", "transformers", "huggingface-hub",
    "Pygments", "colorama", "termcolor",
    "pyserial", "pyusb",
    "moviepy", "imageio", "soundfile",
    "fabric",
]

POPULAR_NPM: list[str] = [
    "react", "vue", "angular", "svelte", "solid-js",
    "next", "nuxt", "gatsby", "remix",
    "express", "fastify", "koa", "nestjs",
    "lodash", "underscore", "ramda",
    "axios", "node-fetch", "got", "superagent",
    "moment", "dayjs", "date-fns",
    "typescript", "babel", "webpack", "vite", "rollup", "esbuild",
    "eslint", "prettier", "jest", "vitest", "mocha", "chai",
    "redux", "mobx", "zustand", "recoil", "jotai",
    "tailwindcss", "styled-components", "emotion",
    "socket.io", "ws",
    "mongoose", "sequelize", "typeorm", "prisma",
    "dotenv", "cross-env",
    "commander", "yargs", "inquirer",
    "chalk", "ora",
    "sharp", "jimp",
    "jsonwebtoken", "bcryptjs", "passport",
    "nodemailer",
    "uuid", "nanoid",
    "zod", "yup", "joi",
    "rxjs", "three", "d3",
]


@dataclass
class SimilarityResult:
    package: str
    is_suspicious: bool
    best_match: str | None
    score: float


def check_similarity(package: str, ecosystem: str = "pypi") -> SimilarityResult:
    """Check a single package name against the seed list."""
    seed = POPULAR_PYPI if ecosystem != "npm" else POPULAR_NPM
    result = process.extractOne(
        package, seed, scorer=fuzz.WRatio, score_cutoff=0,
    )
    if result is None:
        return SimilarityResult(package=package, is_suspicious=False,
                                best_match=None, score=0.0)
    best_match, score, _ = result
    # Exact match => it IS the popular package, not a typosquat
    if package.lower() == best_match.lower():
        return SimilarityResult(package=package, is_suspicious=False,
                                best_match=best_match, score=score)
    is_suspicious = score > SIMILARITY_THRESHOLD
    return SimilarityResult(package=package, is_suspicious=is_suspicious,
                            best_match=best_match, score=score)


def batch_check_similarity(
    packages: list[dict],
) -> list[SimilarityResult]:
    return [
        check_similarity(p["package"], p.get("ecosystem", "pypi"))
        for p in packages
    ]
