from __future__ import annotations

import os

import uvicorn

from .app import create_app


def main() -> None:
    host = os.environ.get("HELIOS_VOICE_HOST", "127.0.0.1")
    port = int(os.environ.get("HELIOS_VOICE_PORT", "9090"))
    uvicorn.run(create_app(), host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
