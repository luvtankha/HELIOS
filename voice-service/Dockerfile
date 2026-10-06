FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
ENV UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src src
COPY benchmarks benchmarks
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH=/app/src
EXPOSE 9090
CMD ["uvicorn","helios_voice_bench.gateway.app:create_app","--factory","--host","0.0.0.0","--port","9090"]
