FROM mcr.microsoft.com/devcontainers/java:1-21-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends pipx postgresql-client util-linux \
    && rm -rf /var/lib/apt/lists/*
