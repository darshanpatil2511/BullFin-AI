# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# apps/ml — FastAPI quant engine. Build from this directory:
#   docker build -t bullfin-ml apps/ml
# -----------------------------------------------------------------------------

FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Build deps: scipy / numpy need a working C toolchain on ARM. libgomp is
# required by numpy at runtime; leave it installed.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential gcc g++ libgomp1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the package source BEFORE `pip install -e .` — the editable install
# resolves the `app` package via setuptools at install time, so the directory
# must exist. (Copying app/ after the install caused Render builds to fail
# with "error: package directory 'app' does not exist".)
COPY pyproject.toml ./
COPY app ./app
RUN pip install --upgrade pip && pip install -e .

RUN addgroup --system bullfin && adduser --system --ingroup bullfin bullfin && \
    chown -R bullfin:bullfin /app
USER bullfin

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=3)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
