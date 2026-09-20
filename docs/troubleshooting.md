# Troubleshooting

| Symptom                  | Likely cause                                                    | Action and verification                                                                                          |
| ------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| API will not start       | Invalid env/default production secret                           | Read the safe startup error; compare private `.env` with [configuration](configuration.md); run `pnpm typecheck` |
| Database unavailable     | Role/database absent, bad URL, migration pending                | Provision locally, update private URL, run `pnpm db:migrate` then `pnpm db:check`                                |
| Web cannot reach API     | Wrong `NEXT_PUBLIC_API_URL`, API down, origin mismatch          | Open `/api/v1/health`; match `WEB_ORIGIN` to browser URL; restart web after public env change                    |
| Microphone unavailable   | Permission/browser/device issue                                 | Allow permission or use typed fallback; mock STT still needs a valid upload flow                                 |
| Voice provider fails     | Missing key/network/provider configuration                      | Use `SPEECH_PROVIDER=mock` or configure optional adapter; never invent transcript success                        |
| OCR fails                | OCR disabled, unsupported/scanned PDF, timeout                  | Use mock/local correctly; local PDF path needs extractable text; try a supported synthetic fixture               |
| Document upload rejected | Size/type/signature/ownership/duplicate check                   | Use an owned PDF/image within configured limit; inspect standard error code                                      |
| Doctor login fails       | Demo mode off, wrong private access code, missing seeded doctor | Use isolated demo profile and `pnpm demo:reset`; this login is not for production                                |
| Queue does not update    | API/database down or tab hidden; polling delay                  | Check health and wait ~8 seconds/reload; there is no WebSocket/SSE                                               |
| Reset is blocked         | Non-demo mode/database, wrong actor/confirmation                | Use presenter page in `pnpm demo:dev`; verify dedicated local DB; never weaken guard                             |
| Reset fails midway       | File/seed/validation failure                                    | Run `pnpm demo:reset`, then `pnpm demo:verify`; do not present until verification succeeds                       |

Never paste `.env`, database passwords, doctor codes, patient tokens, or real patient records into an issue or log.
