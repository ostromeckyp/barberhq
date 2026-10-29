#!/bin/sh
set -eu

cd -- "$(dirname -- "$0")/../.."

# FastMCP otherwise reads the repository's .env automatically.
export FASTMCP_ENV_FILE=/dev/null

if [ "${1:-}" = setup ]; then
  python3 -m venv .code-review-graph/venv
  exec .code-review-graph/venv/bin/python -m pip install \
    -r scripts/dev/code-review-graph-requirements.txt
fi

if [ ! -x .code-review-graph/venv/bin/code-review-graph ]; then
  echo 'Code Review Graph is missing. Run: npm run graph:setup' >&2
  exit 1
fi

exec .code-review-graph/venv/bin/code-review-graph "$@"
