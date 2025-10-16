#!/usr/bin/env python3
"""Idempotently patch airtrain telemetry to respect AIRTRAIN_TELEMETRY_ENABLED."""

from __future__ import annotations

import sys
from pathlib import Path

def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: patch_airtrain.py <venv_dir>", file=sys.stderr)
        return 1

    venv_dir = Path(sys.argv[1]).resolve()
    site_packages = next((p for p in (venv_dir / "lib").glob("python*/site-packages")), None)
    if site_packages is None:
        print(f"Could not locate site-packages under {venv_dir}", file=sys.stderr)
        return 1

    service_path = site_packages / "airtrain" / "telemetry" / "service.py"
    if not service_path.exists():
        # Nothing to patch if airtrain is absent.
        return 0

    original = service_path.read_text()
    updated = original

    sentinel = "Telemetry explicitly disabled via AIRTRAIN_TELEMETRY_ENABLED=false"

    if sentinel not in updated:
        block = (
            "        isBeta = True  # TODO: remove this once out of beta\n"
            "        if telemetry_disabled and not isBeta:\n"
            "            self._posthog_client = None\n"
            "        else:\n"
        )
        replacement = (
            "        isBeta = True  # TODO: remove this once out of beta\n"
            "        if telemetry_disabled:\n"
            "            logger.debug('Telemetry explicitly disabled via AIRTRAIN_TELEMETRY_ENABLED=false')\n"
            "            return\n"
            "        if telemetry_disabled and not isBeta:\n"
            "            self._posthog_client = None\n"
            "        else:\n"
        )
        updated = updated.replace(block, replacement)

    if "self._posthog_client = None" not in updated.splitlines()[:80]:
        # Ensure the attribute is initialised before potential early return.
        needle = (
            "        self.debug_logging = os.getenv('AIRTRAIN_LOGGING_LEVEL', 'info').lower() == 'debug'\n"
            "        \n"
            "        # System information to include with telemetry\n"
        )
        insert = (
            "        self.debug_logging = os.getenv('AIRTRAIN_LOGGING_LEVEL', 'info').lower() == 'debug'\n"
            "        self._posthog_client = None\n"
            "\n"
            "        # System information to include with telemetry\n"
        )
        updated = updated.replace(needle, insert)

    if updated != original:
        service_path.write_text(updated)

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
