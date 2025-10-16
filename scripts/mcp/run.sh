#!/usr/bin/env bash
set -euo pipefail

# Resolve repository root even when invoked via symlink.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PYTHON_BIN=${PYTHON_BIN:-python3.11}
VENV_DIR="${REPO_ROOT}/.venv-mcp"

# Create the virtual environment if missing.
if [ ! -d "${VENV_DIR}" ]; then
  if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
    echo "Error: ${PYTHON_BIN} not found. Install Python 3.11 or set PYTHON_BIN." >&2
    exit 1
  fi
  "${PYTHON_BIN}" -m venv "${VENV_DIR}"
fi

# shellcheck disable=SC1090
source "${VENV_DIR}/bin/activate"

# Ensure the MCP CLI is available.
if ! python -c "import modelcontextprotocol" >/dev/null 2>&1; then
  pip install --upgrade pip
  pip install modelcontextprotocol
fi

# Apply repository patch to disable telemetry network calls if needed.
python "${REPO_ROOT}/scripts/mcp/patch_airtrain.py" "${VENV_DIR}"

# Ensure the local storage directory exists.
export TRMX_DIR="${TRMX_DIR:-${REPO_ROOT}/.trmx-local}"
mkdir -p "${TRMX_DIR}"

# Disable telemetry to avoid network calls inside CI/sandboxed shells.
export AIRTRAIN_TELEMETRY_ENABLED=${AIRTRAIN_TELEMETRY_ENABLED:-false}

exec "${VENV_DIR}/bin/mcp" "$@"
