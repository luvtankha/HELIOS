# HELIOS five-minute synthetic demonstration script

## Before judges arrive

This demonstration uses synthetic records only. Copy `.env.sih-demo.example` to a private repository-root `.env.sih-demo.local`, replace its database password, session secret and doctor access code, and use a dedicated local PostgreSQL `helios_sih_demo` database. The same profile sets the web app's `NEXT_PUBLIC_DEMO_MODE=true` and API URL. With Node 24+, run commands with the explicit profile (ordinary `.env` files are not implicitly loaded by these scripts):

```powershell
node --env-file=.env.sih-demo.local --run db:migrate
node --env-file=.env.sih-demo.local --run demo:reset
node --env-file=.env.sih-demo.local --run dev
```

`ALLOW_DEMO_SEED=true`, `DEMO_MODE=true` and `ENABLE_DEMO_MODE=true` are mandatory. The reset refuses production, non-local PostgreSQL, non-demo database names and databases with non-demo patients. It removes `DEMO-*` patients, `demo.*` users and their related synthetic records, reinstalls private fixture bytes, reseeds, and verifies minimum counts. Never connect this profile to real data. The root `demo:reset` command generates its own document fixtures.

Doctor username: `demo.doctor`  
Second synthetic doctor username: `demo.doctor2` (assigned three showcase patients)  
Doctor access code: the operator-selected value in `DOCTOR_DEMO_ACCESS_CODE`  
Patient access: start a new bearer-protected patient session; there is no shared patient password.  
Admin demo login: intentionally unavailable because Phase 16 prevents shared demo credentials from issuing admin authority.

## Presentation

### 0:00–0:45 — patient intake and multilingual voice simulation

1. Open `/patient`; point out the subtle **DEMO MODE** badge.
2. Start, choose Hindi, and accept the synthetic-data consent.
3. Use fictional details only. Enter: `Demo Patient Live`, age `30`, and no real telephone number.
4. Enter or speak: “Mujhe teen din se bukhar hai aur body pain bhi hai.” If no speech provider is configured, use text; the seeded golden patient also contains a provider-free voice-text simulation.
5. Show that the interview keeps Hindi/Hinglish source wording while producing structured information. Use “Pata nahi” once to demonstrate UNKNOWN is not NO.

### 0:45–1:30 — document, review, submission and token

1. Upload `dataset/documents/phase6-fixtures/demo-current-lab-report.pdf`.
2. Show processing status, OCR evidence, page reference, confidence and the synthetic label. Do not interpret the value medically.
3. Review answers and submit once; repeat submission to show idempotent queue behavior.
4. Show the issued waiting token and refresh behavior. The patient cannot edit number, priority, position or state.

### 1:30–2:15 — doctor queue

1. Open a separate browser session at `/doctor/login` and use `demo.doctor` plus the environment-provided demo code.
2. Point out **DEMO MODE · synthetic data**.
3. Show six seeded tokens, including normal waiting entries, Aarav’s `PRIORITY_REVIEW`, and an in-consultation record.
4. Use CALL NEXT once. Explain that server assignment, state transitions and a serializable transaction—not the UI—select the next token.

### 2:15–3:30 — golden patient workspace

1. Open **Aarav Sharma** (`DEMO-AARAV-024`), explicitly described as fictional.
2. Show two temporally ordered visits, Hindi/Hinglish conversation evidence and the source-linked timeline.
3. Open Clinical Brief. It is generated through the real Phase 9 builder from source records; it is not a hard-coded card.
4. Open What Changed. Highlight Metformin `500 mg → 1000 mg`, Hemoglobin `10.4 → 8.9`, and breathing difficulty `NOT_ASKED → YES`. The Phase 8 engine calculates change categories from timeline source events.
5. Explain that queue `PRIORITY_REVIEW` is an operator/demo queue label, not a SafetyEngine signal. Phase 5 SafetyEngine is not implemented, so this demonstration cannot show a genuine rule-derived safety signal.

### 3:30–4:30 — document evidence and verification

1. Open the current synthetic lab document and its page-level evidence.
2. Show the conflict: patient-reported synthetic allergen versus document-extracted “Penicillin allergy.”
3. In Verification Center, choose VERIFY, CORRECT, REJECT or MARK UNCERTAIN as appropriate. Explain that doctor identity and time come from the server, the action is version/idempotency protected, and the original evidence remains.
4. Refresh the workspace to show the verification/audit update.

### 4:30–5:00 — consultation completion and close

1. Start/complete the selected consultation using allowed queue transitions.
2. Show the patient waiting page move through CALLED/YOUR TURN and completion where practical.
3. Close with the architecture: Patient UI → shared authorized API → isolated demo PostgreSQL ← Doctor UI.
4. Say: “All displayed identities and documents are synthetic. This build is partially secure for an isolated demonstration and is not approved for real patient data.”

## Recovery

- External speech unavailable: select text or use the seeded `synthetic-demo-text-simulation` transcript.
- External AI unavailable: rules-based interview normalization remains enabled.
- OCR demo risk: use the pre-generated clean PDFs; preseeded extraction/evidence is stable, while the live upload still uses the actual Phase 6 pipeline.
- Queue changed during rehearsal: stop the apps, confirm the isolated demo URL, then run `pnpm demo:reset`.
- Reset refuses to run: do not bypass the guard. Confirm local PostgreSQL, both demo flags, `ALLOW_DEMO_SEED=true`, non-production `NODE_ENV`, and a dedicated `helios_demo`/`helios_sih_demo` database.

## Showcase inventory

The deterministic seed defines 12 synthetic patients, 13 visits, three private golden-patient documents, five interview responses, one voice-text simulation, six queue tokens, source timeline events, one prior verification, one AYUSH record and diverse complaints/symptoms. `pnpm demo:verify` queries the database and prints the authoritative generated counts after every seed/reset.
