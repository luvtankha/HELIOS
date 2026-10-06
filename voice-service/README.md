# HELIOS native voice gateway

FastAPI bridges authenticated 24 kHz PCM16 browser audio to Gemini Live. Gemini consumes and produces native audio; structured tool calls send patient-reported facts to the Java intake service. Hindi output captions drive the speech bubble. No STT/TTS cascade is used by the active provider.

Start all services from the root with `pnpm dev:v2`. For this service alone, configure the private environment, run `uv sync --no-install-project`, then:

```powershell
uv run --no-sync python -m uvicorn helios_voice_bench.gateway.app:create_app --factory --app-dir src --host 127.0.0.1 --port 9090
```

Required: `GEMINI_API_KEY`, `HELIOS_VOICE_RUNTIME_SECRET`, `HELIOS_VOICE_CONTROL_SECRET`, and `HELIOS_PATIENT_API_URL`. Defaults: provider `gemini-live`, model `gemini-3.8-live`. Use a free-tier project with billing disabled for quota-limited free usage.

`GET /healthz` reports process/configuration health, not a vendor connection test. From the root, `pnpm voice:smoke` makes a real synthetic Hindi request; `pnpm voice:roundtrip` exercises local patient intake with synthetic speech.

Unit checks from this directory:

```powershell
$env:PYTHONPATH='src'
uv run --no-sync python -m unittest discover -s tests
```

The existing Human-1/Moshi adapter and H01–H15 benchmark harness remain experimental. `benchmark_approved=false` means no clinical/model acceptance benchmark is claimed. Configured native audio and connectivity are separate checks. Benchmark evidence must be measured.

See [the live consultation guide](../docs/live-consultation.md).
