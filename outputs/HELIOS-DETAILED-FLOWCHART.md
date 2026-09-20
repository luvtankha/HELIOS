# HELIOS — detailed system flow through Phase 12

This document maps the implemented repository as of Phase 12. Solid arrows are implemented runtime flow. Dashed arrows identify optional providers, derived projections, invalidation, or explicitly unimplemented boundaries. The source clinical records remain authoritative; timelines, comparisons, briefs, and verification queues are projections or review layers.

## 1. Whole-system map

```mermaid
flowchart TB
  subgraph Actors[People and user surfaces]
    Patient[Patient]
    Doctor[Doctor or demo clinician]
    PatientUI[Next.js patient application]
    DoctorUI[Next.js doctor workspaces]
    Patient --> PatientUI
    Doctor --> DoctorUI
  end

  subgraph Browser[Browser-side responsibilities]
    Router[Next.js App Router]
    FlowProvider[PatientFlowProvider]
    LocalState[localStorage: IDs, proof, step, language]
    DraftState[sessionStorage: form drafts]
    Media[MediaRecorder + Web Audio levels]
    APIClients[Typed HTTP service modules]
    I18N[Shared locale registry + useTranslation]
    PatientUI --> Router --> FlowProvider
    FlowProvider <--> LocalState
    FlowProvider <--> DraftState
    PatientUI --> Media
    PatientUI --> I18N
    DoctorUI --> I18N
    FlowProvider --> APIClients
    Media --> APIClients
    DoctorUI --> APIClients
  end

  subgraph API[Express API on port 5000]
    HTTP[HTTP server and graceful shutdown]
    Middleware[Request ID -> Pino log -> Helmet -> CORS -> body limits]
    Routes[Versioned /api/v1 routers]
    Validation[Zod body, params, and query validation]
    Controllers[Controllers and response envelopes]
    Services[Domain/application services]
    Repositories[Prisma repositories]
    Errors[404 + centralized AppError handler]
    HTTP --> Middleware --> Routes --> Validation --> Controllers --> Services --> Repositories
    Routes --> Errors
    Controllers --> Errors
    Services --> Errors
  end

  APIClients -->|JSON or bounded multipart + proof header| HTTP
  Controllers -->|success/data or error/code/message/requestId| APIClients

  subgraph Domain[Implemented domain engines]
    PatientFlow[PatientFlowService]
    Voice[VoiceService]
    Interview[InterviewService + InterviewEngine]
    Document[DocumentService]
    Language[LanguageService]
    Timeline[TimelineService + rebuild engine]
    Compare[ComparisonService + deterministic engine]
    Brief[ClinicalBriefService + deterministic builder]
    Verify[VerificationService]
    Ayush[AYUSH service + normalizer]
    Services --> PatientFlow
    Services --> Voice
    Services --> Interview
    Services --> Document
    Services --> Language
    Services --> Timeline
    Services --> Compare
    Services --> Brief
    Services --> Verify
    Services --> Ayush
  end

  subgraph Providers[Provider-neutral external or local adapters]
    SpeechI[SpeechProvider interface]
    MockSpeech[Deterministic mock speech]
    OpenAISpeech[Optional OpenAI transcription]
    NLUI[Clinical NLU provider boundary]
    Rules[Deterministic rules fallback]
    OpenAINLU[Optional strict structured OpenAI NLU]
    OCRI[OCR provider interface]
    MockOCR[Mock/text extraction]
    LocalOCR[Local PDF.js, Sharp, Tesseract]
    Translation[Approved-resource translation provider]
    Voice --> SpeechI
    SpeechI --> MockSpeech
    SpeechI -. configured .-> OpenAISpeech
    Interview --> NLUI
    NLUI --> Rules
    NLUI -. configured .-> OpenAINLU
    Document --> OCRI
    OCRI --> MockOCR
    OCRI -. configured .-> LocalOCR
    Language --> Translation
  end

  subgraph Persistence[Authoritative and derived persistence]
    Prisma[Prisma Client]
    Postgres[(PostgreSQL)]
    PrivateFiles[(Private document storage; never publicly mounted)]
    Audit[(Metadata-minimized AuditLog)]
    Repositories --> Prisma --> Postgres
    Document --> PrivateFiles
    PatientFlow --> Audit
    Timeline --> Audit
    Compare --> Audit
    Brief --> Audit
    Verify --> Audit
    Ayush --> Audit
  end

  PatientFlow --> Interview
  Voice --> Interview
  Interview --> Ayush
  Document --> Ayush
  Document --> Timeline
  PatientFlow --> Timeline
  Ayush --> Timeline
  Timeline --> Compare
  Compare --> Brief
  Verify -->|source status update + invalidation| Timeline
  Verify -. marks stale .-> Compare
  Verify -. marks stale .-> Brief
  Ayush -. marks stale .-> Compare
  Ayush -. marks stale .-> Brief

  MissingSafety[Phase 5 SafetyEngine: NOT IMPLEMENTED]
  RiskStorage[RiskSignal storage/read only]
  Timeline -. may display already stored signals .-> RiskStorage
  Brief -. may summarize already stored signals .-> RiskStorage
  RiskStorage -. no evaluator .-> MissingSafety
```

## 2. API boot and request lifecycle

```mermaid
flowchart TD
  Start[Run pnpm dev or API start] --> LoadEnv[Parse and validate environment configuration]
  LoadEnv --> BuildDB[Create Prisma database service]
  LoadEnv --> SelectProviders[Select speech, NLU, OCR, storage, feature flags]
  BuildDB --> Compose[createApp composes all services and routers]
  SelectProviders --> Compose
  Compose --> Disable[Disable x-powered-by]
  Disable --> Context[Attach or generate request ID]
  Context --> LogStart[Start structured request logging with redaction]
  LogStart --> Headers[Apply Helmet security headers]
  Headers --> Cors[Allow configured WEB_ORIGIN and supported methods]
  Cors --> Limits[Apply 1 MB JSON/urlencoded limits]
  Limits --> Mount[Mount health and /api/v1 routers]
  Mount --> Listen[HTTP server listens on configured PORT]
  Listen --> Timeouts[15 s request, 20 s headers, 5 s keep-alive]

  Request[Incoming request] --> Context
  Limits --> RouteMatch{Known route?}
  RouteMatch -->|No| NotFound[NOT_FOUND handler]
  RouteMatch -->|Yes| UploadKind{JSON, audio, or document?}
  UploadKind -->|JSON| Zod[Validate params/query/body with Zod]
  UploadKind -->|Audio| AudioGuard[Multipart fields + size + MIME + signature + duration]
  UploadKind -->|Document| DocGuard[Rate limit + size + extension + MIME + signature + ownership]
  Zod --> Auth{Proof required?}
  AudioGuard --> Auth
  DocGuard --> Auth
  Auth -->|Patient| SessionProof[Verify HMAC opaque session proof and ownership]
  Auth -->|Doctor| DoctorProof[Verify signed doctor token, active role, patient access]
  Auth -->|Public route| Controller[Controller]
  SessionProof --> Controller
  DoctorProof --> Controller
  Controller --> Service[Application service]
  Service --> Repo[Repository transaction/query]
  Repo --> Prisma[(PostgreSQL via Prisma)]
  Prisma --> Serialize[DTO serializer removes private/provider fields]
  Serialize --> Success[success=true, data=...]
  Zod -->|Invalid| Error[Central error handler]
  AudioGuard -->|Invalid| Error
  DocGuard -->|Invalid| Error
  SessionProof -->|Invalid/cross-patient| Error
  DoctorProof -->|Invalid/inactive| Error
  Service -->|AppError or failure| Error
  Error --> Failure[success=false, error code/message/requestId; no production stack]
  Success --> LogEnd[Log method/path/status/duration/requestId]
  Failure --> LogEnd
```

## 3. Complete patient check-in and resume flow

```mermaid
flowchart TD
  Entry[/patient welcome/] --> Choice{Start or resume?}
  Choice -->|Start| NewSession[POST /patient-sessions with default en]
  NewSession --> SessionRow[Create PatientSession STARTED/WELCOME]
  SessionRow --> Proof[Return opaque HMAC sessionToken]
  Proof --> PersistIDs[Store IDs/proof/step/language in localStorage]
  PersistIDs --> Language[/patient/language/]
  Choice -->|Resume| ReadID[Read session ID from localStorage]
  ReadID --> GetSession[GET /patient-sessions/:id]
  GetSession --> Hydrate[Hydrate patient, visit, complaint, drafts, step, language]
  Hydrate --> RouteByStep[Map PatientFlowStep to route]

  Language --> SelectLanguage{Select supported language}
  SelectLanguage -->|English en| SaveLang[PATCH session progress]
  SelectLanguage -->|Hindi hi| SaveLang
  SelectLanguage -->|Coming soon language| Stay[Disabled/unavailable; remain on page]
  SaveLang --> Preserve{Initial selection?}
  Preserve -->|Step LANGUAGE| Consent[/patient/consent/]
  Preserve -->|Mid-flow switch| SameStep[Return to current step without deleting answers]

  Consent --> Explain[Show privacy, purpose, review, and no-diagnosis statements]
  Explain --> Explicit{Checkbox accepted?}
  Explicit -->|No| Block[Continue remains disabled]
  Explicit -->|Yes| SaveConsent[POST /consents; versioned ConsentRecord]
  SaveConsent --> Details[/patient/details/]

  Details --> ValidateDetails[Validate name, age 0-120, sex, optional phone]
  ValidateDetails -->|Invalid| FriendlyErrors[Inline accessible errors; retain draft]
  ValidateDetails -->|Valid| CreatePatient[POST /patients with session ID]
  CreatePatient --> AtomicIntake[Create PatientProfile + PRE_CONSULTATION Visit + bind session]
  AtomicIntake --> Complaint[/patient/complaint/]

  Complaint --> InputChoice{Type or speak?}
  InputChoice -->|Type| ComplaintText[Patient enters own words]
  InputChoice -->|Voice| VoiceFlow[Open /patient/listening voice flow]
  VoiceFlow --> ConfirmedTranscript[Patient edits/confirms transcript]
  ConfirmedTranscript --> ComplaintText
  ComplaintText --> ValidateComplaint[Minimum/maximum validation; preserve original wording]
  ValidateComplaint --> InterviewStart[POST /interviews with session, visit, chief complaint]
  InterviewStart --> Adaptive[/patient/interview/]

  Adaptive --> Question[Server selects exactly one localized question]
  Question --> AnswerMode{Choice, multiselect, duration, severity, text, date, yes/no, voice}
  AnswerMode --> DraftAnswer[Capture raw answer]
  DraftAnswer --> Preview[POST response; interpret but do not confirm]
  Preview --> PatientConfirm{Patient confirms normalized preview?}
  PatientConfirm -->|Edit/retry| DraftAnswer
  PatientConfirm -->|Yes| Confirm[POST interview confirm]
  Confirm --> Autosave[Persist response + confirmed state]
  Autosave --> Missing{Required facts or conflicts remain?}
  Missing -->|Conflict| Clarify[Ask a deterministic clarification question]
  Clarify --> Question
  Missing -->|Missing| Question
  Missing -->|Complete| PreFinal[Interview REVIEW summary]
  PreFinal --> Revise{Revise a field?}
  Revise -->|Yes| Reopen[POST revise; set field NOT_ASKED]
  Reopen --> Question
  Revise -->|No| CompleteInterview[POST complete; materialize ClinicalHistory]
  CompleteInterview --> OptionalDocs{Add previous document?}
  OptionalDocs -->|Yes| Documents[/patient/documents/]
  OptionalDocs -->|Skip| Review[/patient/review/]
  Documents --> Review

  Review --> EditAny{Edit basic info, complaint, health details, documents?}
  EditAny -->|Yes| RouteBack[Return to selected page and resave]
  RouteBack --> Review
  EditAny -->|No| Submit[POST /patient-sessions/:id/submit]
  Submit --> Ready[Session COMPLETED; Visit READY_FOR_DOCTOR]
  Ready --> TimelineProjection[Project visit/source facts to timeline]
  TimelineProjection --> Complete[/patient/complete/ token and next steps]
  Complete --> PatientTimeline[/patient/timeline/]
  Complete --> Reset{Done?}
  Reset -->|Yes| Clear[Clear localStorage/sessionStorage and return home]
```

## 4. Browser state, persistence, and failure recovery

```mermaid
flowchart LR
  UIEvent[Patient UI action] --> Context[PatientFlowProvider React context]
  Context --> Memory[Current in-memory state]
  Memory --> Local[localStorage: sessionId, sessionToken, patientId, visitId, interviewId, pendingQuestionId, step, language]
  Memory --> Draft[sessionStorage: details, complaint, answers]
  Context --> Client[Patient API service]
  Client --> API[Express API]
  API --> DB[(Authoritative PostgreSQL state)]
  DB --> DTO[Serialized session DTO]
  DTO --> Hydrate[Hydrate merges server state with safe local draft]
  Hydrate --> Memory
  Client -->|network unavailable| Error[Human-readable error]
  Error --> Draft
  Error --> Retry[Retry without discarding typed input]
  Reload[Browser reload] --> Read[Read both storage areas]
  Read --> Memory
  Resume[Resume action] --> API
  Reset[Patient finishes and chooses Done] --> Clear[Remove both storage keys]
  Clear --> Fresh[Reset to initial WELCOME state]
```

## 5. Adaptive interview and clinical NLU

```mermaid
flowchart TD
  Complaint[Chief complaint in original patient words] --> Classifier{Deterministic pathway classifier}
  Classifier --> Abd[abdominal_pain]
  Classifier --> Chest[chest_discomfort]
  Classifier --> Head[headache]
  Classifier --> Fever[fever]
  Classifier --> Cough[cough_breathing]
  Classifier --> General[general_pain fallback]
  Abd --> InitialFacts[Initialize state and extract bounded duration/vomiting clues]
  Chest --> InitialFacts
  Head --> InitialFacts
  Fever --> InitialFacts
  Cough --> InitialFacts
  General --> InitialFacts

  InitialFacts --> ActiveGraph[Load versioned pathway questions + common AYUSH branch]
  ActiveGraph --> Dependencies[Filter dependency-controlled questions]
  Dependencies --> Conflicts{Existing conflict?}
  Conflicts -->|Yes| ConflictQ[Generate clarify.field yes/no question priority 1000]
  Conflicts -->|No| Required[Find highest-priority uncaptured required field]
  Required --> Localize[Localize question text and visible options to en/hi]
  Localize --> StableValues[Keep optionValues language-neutral for submission]
  StableValues --> Browser[Render one question]

  Browser --> Raw[Submit rawAnswer, language, source]
  Raw --> Ownership[Verify interview belongs to signed patient session]
  Ownership --> Detect[Detect English/Hindi/mixed language metadata]
  Detect --> Provider{Configured ClinicalNLU provider}
  Provider -->|rules/default| Deterministic[Deterministic normalization]
  Provider -. optional .-> OpenAI[Strict schema OpenAI interpretation; storage disabled]
  OpenAI --> Validate[Validate structured output with Zod]
  Validate -->|Invalid| Retry[One constrained retry]
  Retry -->|Still invalid| Deterministic
  Deterministic --> Result[NormalizedAnswer: field/value/state/confidence/source/ambiguity]
  Validate -->|Valid| Result
  Result --> Existing{Contradicts an existing captured value?}
  Existing -->|Yes| Conflict[State CONFLICT; do not overwrite silently]
  Existing -->|No| Preview[Return normalized preview]
  Conflict --> Preview
  Preview --> Confirm{Patient confirms?}
  Confirm -->|No/edit| Raw
  Confirm -->|Yes| Persist[Confirm response and atomically update Interview state]
  Persist --> States[Knowledge states: YES, NO, UNKNOWN, NOT_ASKED, NOT_APPLICABLE, CONFLICT]
  States --> Complete{All active required fields captured and no conflict?}
  Complete -->|No| ActiveGraph
  Complete -->|Yes| Review[Pre-final review/revision]
  Review --> Materialize[Create/update ClinicalHistory; mark interview COMPLETED]
  Materialize --> Audit[Operational AI metadata may be stored; transcripts excluded from generic logs]
```

## 6. Voice recording and transcription state machine

```mermaid
stateDiagram-v2
  [*] --> IDLE
  IDLE --> PERMISSION_REQUEST: tap microphone
  PERMISSION_REQUEST --> READY: permission + recorder available
  PERMISSION_REQUEST --> ERROR: denied/unsupported
  READY --> RECORDING: MediaRecorder starts
  RECORDING --> STOPPING: patient stops or duration ceiling reached
  RECORDING --> CANCELLED: patient cancels
  STOPPING --> UPLOADING: Blob complete and signature-capable format selected
  UPLOADING --> TRANSCRIBING: API accepted bounded multipart upload
  UPLOADING --> ERROR: size/type/signature/session failure
  TRANSCRIBING --> TRANSCRIBED: provider returns original transcript
  TRANSCRIBING --> ERROR: timeout/provider/empty transcript
  TRANSCRIBED --> AWAITING_CONFIRMATION: show patient transcript
  AWAITING_CONFIRMATION --> EDITING: edit text
  EDITING --> AWAITING_CONFIRMATION: save edit
  AWAITING_CONFIRMATION --> CONFIRMED: patient says it is correct
  AWAITING_CONFIRMATION --> IDLE: retry creates a new interaction
  ERROR --> IDLE: try again
  ERROR --> EDITING: type instead
  CANCELLED --> IDLE
  CONFIRMED --> [*]
```

```mermaid
flowchart TD
  BrowserAudio[MediaRecorder audio Blob + declared language + session proof] --> UploadGuard[Server multipart guard]
  UploadGuard --> Size[Enforce VOICE_MAX_FILE_BYTES]
  Size --> Mime[Allowlisted MIME/extension]
  Mime --> Signature[Inspect bytes; ignore unsafe client filename]
  Signature --> Session[Verify proof and resolve session/visit server-side]
  Session --> Provider[SpeechProvider.transcribe]
  Provider --> Mock[Mock provider for deterministic local/test use]
  Provider -. optional .-> OpenAI[OpenAI speech adapter with timeout]
  Mock --> SpeechResult[originalTranscript + detected language(s) + confidence + optional normalized text]
  OpenAI --> SpeechResult
  SpeechResult --> Persist[Create VoiceInteraction; retained=false]
  Persist --> Destroy[Raw audio buffer is not persisted by HELIOS]
  Persist --> PatientReview[Return safe DTO for edit/confirm]
  PatientReview --> Edit[Persist patientEditedTranscript separately]
  PatientReview --> Confirm[Persist acceptedTranscript separately]
  Confirm --> InterviewOrComplaint[Use only patient-confirmed transcript downstream]
  Persist --> Log[Log operation/provider/status/latency/error code only]
```

## 7. Multilingual language layer

```mermaid
flowchart TD
  Registry[Central LanguageRegistry] --> Supported{Status}
  Supported -->|SUPPORTED| EN[English en, LTR]
  Supported -->|SUPPORTED| HI[Hindi hi, LTR]
  Supported -->|COMING_SOON| Future[Tamil, Telugu, Marathi, Bengali, Gujarati, Kannada, Malayalam, Punjabi, Odia, Urdu]
  Future --> Disabled[Visible capability metadata but cannot be selected as active]
  Registry --> Locale[Parity-validated localeMessages]
  Locale --> PatientLabels[Patient labels, progress, consent, interview, errors]
  Locale --> DoctorLabels[Brief and AYUSH doctor labels]
  Registry --> Questions[Question-localization catalog]
  Questions --> DisplayQuestion[Localized question + localized options]
  Questions --> OptionValues[Stable internal option values]

  Original[Original patient speech/text/document content] --> Detect[Language detector]
  Detect --> Meta[primaryLanguage + detectedLanguages + confidence + mixed/uncertain]
  Original --> Normalize[MultilingualClinicalNormalizer]
  Glossary[Versioned clinical glossary: concept IDs, en/hi terms, synonyms, transliterations] --> Normalize
  Normalize --> Canonical[Language-neutral concept/state/value]
  Original --> Translation[Approved-resource translation abstraction]
  Translation --> Available{Approved mapping exists?}
  Available -->|Yes| Display[Replaceable display translation]
  Available -->|No| Fallback[Return original with explicit fallback metadata]

  Original --> Evidence[(Immutable original evidence)]
  Canonical --> ClinicalState[(Structured clinical facts)]
  Display --> UI[Chosen display language]
  Fallback --> UI
  Evidence -. never overwritten by .-> Display
  UI -. language switch changes presentation only .-> ClinicalState
  Meta --> VoiceRecord[Voice detected-language metadata]
  Meta --> InterviewRecord[Interview original/display language metadata]
  Meta --> DocumentRecord[Document and fact language metadata]
```

## 8. Medical document upload, OCR, extraction, review, and projection

```mermaid
flowchart TD
  Start[/patient/documents: optional/] --> Source{Camera or file picker}
  Source --> Preview[Local preview before upload]
  Preview --> Confirm{Confirm upload?}
  Confirm -->|No| Source
  Confirm -->|Yes| Multipart[POST /documents with session proof]
  Multipart --> Rate[Per-session bounded rate limit]
  Rate --> Validate[Validate owner, max bytes, extension, MIME, magic signature]
  Validate --> Hash[SHA-256 content hash]
  Hash --> Duplicate{Same patient/file hash already exists?}
  Duplicate -->|Yes| Existing[Return duplicate conflict/reference]
  Duplicate -->|No| Sanitize[Sanitize display filename; generate opaque private storage key]
  Sanitize --> Store[(Private file storage, not public web root)]
  Store --> Document[Create MedicalDocument UPLOADED + processing job]
  Document --> Process[POST process or processing orchestration]

  Process --> Preprocess[PREPROCESSING: PDF/image decode, rotate/resize as supported]
  Preprocess --> OCR[OCR_PROCESSING via configured OCR provider]
  OCR --> Pages[Persist ordered DocumentPage text/confidence/dimensions]
  Pages --> DetectLanguage[Detect document + per-fact original language]
  Pages --> Classify[Conservative type: prescription/lab/discharge/consultation/unknown]
  Classify --> Extract[Schema-bound fact extraction]
  Extract --> Facts[DocumentFact originalValue + normalizedValue + confidence + status + source]
  Facts --> Evidence[DocumentEvidence page/sourceText/bounding box]
  Extract --> Identity[Patient identity signal]
  Identity --> Match{Matched, mismatch, not present, pending?}
  Match -->|Mismatch| Block[Require explicit manual override before attaching details]
  Match -->|Acceptable/override| Review[REVIEW_REQUIRED]
  Review --> PatientAction{Per fact: confirm, edit normalized value, reject}
  PatientAction --> Facts
  Facts --> Verified{Review complete?}
  Verified -->|Yes| DocVerified[Document VERIFIED]
  Verified -->|No| Review
  DocVerified --> AyushExtract[Project conservative AYUSH facts where present]
  DocVerified --> TimelineProject[Incrementally project document/facts to Timeline]
  TimelineProject --> ReviewPage[Return to patient review]

  OCR -->|provider/timeout/decode error| Failed[FAILED with sanitized error metadata]
  Failed --> Retry[Retry processing without re-upload]
  Retry --> Process
  Failed --> Replace[Upload another copy]
  Delete[DELETE document] --> Remove[Ownership check -> remove private file and records]
```

## 9. Longitudinal timeline projection and query

```mermaid
flowchart TD
  subgraph Sources[Authoritative source records]
    Visits[Visits]
    Symptoms[Symptoms]
    History[ClinicalHistory]
    Medications[Medications]
    Allergies[Allergies]
    Observations[Observations]
    Documents[MedicalDocument + DocumentFact]
    Verifications[DoctorVerification]
    Ayush[AYUSH records]
    ExistingRisk[Already-stored RiskSignal only]
  end
  Sources --> Builder[TimelineEventBuilder source-specific mappings]
  Builder --> Temporal[Assign event date separately from recordedAt]
  Temporal --> Precision[Date precision: exact/month/year/range/unknown]
  Precision --> State[Temporal state: current/historical/unknown/discontinued/not-applicable]
  State --> Provenance[Source + verification status + origin type/ID + evidence]
  Provenance --> Normalize[TimelineNormalizer creates normalized key]
  Normalize --> Fingerprint[Deterministic SHA-256 projection fingerprint]
  Fingerprint --> Existing{Projection with same stable identity?}
  Existing -->|No| Insert[Insert TimelineEvent]
  Existing -->|Same fingerprint| Keep[No duplicate/no rewrite]
  Existing -->|Changed fingerprint| Version[Snapshot old values in TimelineEventVersion]
  Version --> Update[Update current projection]
  Existing -->|Source removed/rejected| Reject[Version then mark projection REJECTED]
  Insert --> Conflict[TimelineConflictService]
  Update --> Conflict
  Conflict --> Separate[Keep differing sources separate; add conflict key/label]
  Separate --> Group[TimelineAggregator creates visual visit/report groups without merging facts]
  Group --> Store[(TimelineEvent index)]

  List[GET patient timeline + signed session proof] --> Ownership[Verify patient-session ownership]
  Ownership --> Filters[Validate type/source/status/date/conflict filters and limit]
  Filters --> Query[Server-side PostgreSQL query]
  Query --> Order[Order eventDate, recordedAt, createdAt, ID; unknown dates last]
  Order --> Cursor[Opaque cursor pagination]
  Cursor --> DTO[Patient-safe DTO omits storage/provider debug fields]
  DTO --> UI[Patient timeline cards and filters]
  UI --> Detail[GET timeline/:eventId]
  Detail --> EvidenceRoute[TimelineEvent -> DocumentFact -> DocumentEvidence/content]
  List --> Audit[Metadata-minimized view AuditLog]
  Rebuild[POST patient timeline/rebuild] --> SinglePatient[Rebuild only requested patient]
  SinglePatient --> Builder
  Rebuild --> Audit
```

## 10. Deterministic “What Changed?” comparison

```mermaid
flowchart TD
  DoctorUI[Doctor What Changed workspace] --> SignIn[Demo doctor session/token]
  SignIn --> SelectPatient[Select authorized patient]
  SelectPatient --> SelectVisits[Choose baseline and current visits]
  SelectVisits --> Create[POST comparison or quick comparison]
  Create --> Auth[Verify active doctor/admin token]
  Auth --> SnapshotBuilder[Build immutable PatientSnapshot for each visit]
  SnapshotBuilder --> Hashes[Hash snapshot contents + record source revisions]
  Hashes --> Cache{Same baseline hash, current hash, and engine version?}
  Cache -->|Yes| Reuse[Return cached comparison]
  Cache -->|No| Normalize[Normalize comparable entities/fields]
  Normalize --> Match[EntityMatcher: stable IDs and conservative semantic keys]
  Match --> Confidence[Match confidence HIGH/MEDIUM/LOW/NONE]
  Confidence --> CompareFields[FieldComparator]
  CompareFields --> Delta[Compute values and numeric delta where meaningful]
  Delta --> Classify{Classify recorded relationship}
  Classify --> New[NEW or NEWLY_CAPTURED]
  Classify --> Removed[REMOVED: not recorded now, never assumed resolved]
  Classify --> Changed[CHANGED]
  Classify --> Same[UNCHANGED]
  Classify --> Conflict[CONFLICTED]
  Classify --> Unknown[UNKNOWN]
  Classify --> NC[NOT_COMPARABLE]
  New --> ChangeRows[Persist ChangeRecord with before/after/source/evidence]
  Removed --> ChangeRows
  Changed --> ChangeRows
  Same --> ChangeRows
  Conflict --> ChangeRows
  Unknown --> ChangeRows
  NC --> ChangeRows
  ChangeRows --> Comparison[(Comparison GENERATED)]
  Comparison --> UI[Filter/hide unchanged, expand evidence]
  SourceChange[Source fact revision or verification] -. invalidates .-> Stale[Mark previous comparison STALE]
  Stale --> Create
  Comparison -. read by .-> Brief[Clinical Brief What Changed section]
```

## 11. Clinical Brief generation and evidence

```mermaid
flowchart TD
  Request[Doctor requests quick or persisted brief] --> Auth[Verify signed active doctor]
  Auth --> Repo[ClinicalBriefRepository loads bounded source bundle]
  Repo --> Current[Current visit and patient snapshot]
  Repo --> Symptoms[Current symptoms/history]
  Repo --> Meds[Medications and allergies]
  Repo --> Obs[Recent observations]
  Repo --> Docs[Recent documents]
  Repo --> Comparison[Latest non-stale comparison]
  Repo --> Risk[Already-stored risk signals]
  Repo --> Ayush[AYUSH use]
  Current --> Builder[Deterministic ClinicalBriefBuilder]
  Symptoms --> Builder
  Meds --> Builder
  Obs --> Builder
  Docs --> Builder
  Comparison --> Builder
  Risk --> Builder
  Ayush --> Builder
  Builder --> Bound[Apply BRIEF_MAX limits and recent-month window]
  Bound --> Relevance[Deterministic relevance, deduplication, source priority for display]
  Relevance --> Sections[Structured sections]
  Sections --> Snapshot[PATIENT_SNAPSHOT]
  Sections --> Reason[TODAYS_REASON]
  Sections --> CurrentSymptoms[CURRENT_SYMPTOMS]
  Sections --> Changes[WHAT_CHANGED]
  Sections --> History[RELEVANT_HISTORY]
  Sections --> Medication[MEDICATIONS + ALLERGIES]
  Sections --> Investigations[INVESTIGATIONS + SUPPORTING_DOCUMENTS]
  Sections --> Safety[SAFETY_ATTENTION from stored inputs only]
  Sections --> Verification[NEEDS_VERIFICATION]
  Sections --> Evidence[SOURCE_EVIDENCE]
  Sections --> AyushSection[AYUSH_USE]
  Sections --> Claims[BriefClaim rows with source IDs, provenance, confidence, evidence]
  Claims --> Narrative[Template narrative renderer]
  Narrative --> Unavailable{Dependency failed or absent?}
  Unavailable -->|Failure| Explicit[Mark section UNAVAILABLE, never reassuring absence]
  Unavailable -->|Available| Persist[Persist versioned ClinicalBrief GENERATED]
  Explicit --> Persist
  Persist --> UI[30-second doctor brief view]
  UI --> Drill[Open claim/evidence/document source]
  UI --> Review[Mark REVIEWED or ARCHIVED]
  SourceMutation[Verification, AYUSH, source revision] -. invalidates .-> Stale[Mark brief STALE]
  Stale --> Refresh[POST refresh creates/reuses current version]
```

## 12. Doctor verification transaction

```mermaid
flowchart TD
  Queue[GET verification queue] --> Auth[Validate signed active doctor/admin]
  Auth --> Projection[Build review projection; queue is not a second record]
  Projection --> ReviewID[Opaque reviewId encodes validated fact type + fact ID]
  ReviewID --> Detail[Resolve patient ownership, source, current value/version, evidence]
  Detail --> SideBySide[Show original source beside normalized/current fact]
  SideBySide --> Decision{Explicit doctor action}
  Decision --> Verify[VERIFY]
  Decision --> Correct[CORRECT with fact-type allowlisted fields]
  Decision --> Reject[REJECT]
  Decision --> Uncertain[MARK_UNCERTAIN]
  Decision --> Current[CONFIRM_CURRENT conflict choice]
  Decision --> Previous[KEEP_PREVIOUS conflict choice]
  Decision --> Bulk[BULK_VERIFY eligible non-conflict items]
  Verify --> Validate[Validate body, action, ownership, expected version, idempotency key]
  Correct --> Validate
  Reject --> Validate
  Uncertain --> Validate
  Current --> Validate
  Previous --> Validate
  Bulk --> Validate
  Validate --> Version{Expected source version still current?}
  Version -->|No| Conflict409[Return concurrency conflict; do not overwrite]
  Version -->|Yes| Idempotent{Same idempotency key already committed?}
  Idempotent -->|Yes| Replay[Return prior result]
  Idempotent -->|No| Tx[Database transaction]
  Tx --> Ledger[Append immutable DoctorVerification original + verified JSON]
  Tx --> Audit[Append AuditLog with actor/action/entity/request metadata]
  Tx --> SourceState[Update allowed source fact verification/status/version]
  SourceState --> Commit[Commit transaction]
  Commit --> Invalidate[Mark dependent comparisons and briefs stale]
  Invalidate --> Rebuild[Request patient timeline rebuild]
  Rebuild -->|Success| Result[Return updated review result]
  Rebuild -->|Failure after commit| Warn[Keep decision; expose downstream refresh warning]
  Ledger --> History[Verification history endpoint]
  SideBySide --> Document[Authorized document metadata/content endpoints]
  Model[LLM/provider] -. never allowed to act .-> Decision
```

## 13. AYUSH capture and integration

```mermaid
flowchart TD
  Sources{AYUSH input source} -->|Patient adaptive interview| Interview[Common conditional AYUSH questions]
  Sources -->|Confirmed voice answer| Voice[Original and accepted transcript]
  Sources -->|Medical document| Document[Conservative document extraction + evidence]
  Sources -->|Doctor entry| Doctor[Authorized doctor AYUSH endpoint]
  Interview --> Normalize[AYUSH normalizer]
  Voice --> Normalize
  Document --> Normalize
  Doctor --> Validate[Validate explicit structured fields]
  Normalize --> System{Recognized system?}
  System --> Ayurveda[AYURVEDA]
  System --> Yoga[YOGA_NATUROPATHY]
  System --> Unani[UNANI]
  System --> Siddha[SIDDHA]
  System --> Homeo[HOMOEOPATHY]
  System --> Other[OTHER_TRADITIONAL_SYSTEM]
  System --> Unknown[UNKNOWN; never invent medicine/system]
  Ayurveda --> Record[AyushRecord]
  Yoga --> Record
  Unani --> Record
  Siddha --> Record
  Homeo --> Record
  Other --> Record
  Unknown --> Record
  Validate --> Record
  Record --> Fields[Original/normalized name, ingredients, dose, frequency, route, practitioner, reason, dates, status, reported effect]
  Fields --> Provenance[Source remains patient/document/doctor; verification is separate]
  Provenance --> Audit[Audit mutation]
  Provenance --> Timeline[AYUSH_TREATMENT timeline event]
  Provenance --> Compare[AYUSH_RECORD comparison entity]
  Provenance --> Brief[AYUSH_USE brief section]
  Provenance --> Verification[Existing doctor verification ledger]
  Record -. does not perform .-> NoInteraction[No interaction inference]
  Record -. does not perform .-> NoEfficacy[No efficacy or causality claim]
  Record -. does not perform .-> NoAdvice[No prescription or recommendation]
  Mutation[New/corrected AYUSH record] -. marks stale .-> Compare
  Mutation -. marks stale .-> Brief
  Mutation --> Timeline
```

## 14. Persistence map: source records, projections, and ledgers

```mermaid
flowchart TB
  User[User: future identity/role/status/preferred language] --> Patient[PatientProfile]
  User --> DoctorActions[DoctorVerification actor]
  Session[PatientSession: resumable step/status/language/draft] --> Patient
  Session --> Consent[ConsentRecord: versioned explicit acceptance]
  Session --> Visit[Visit: pre-consultation/follow-up]
  Patient --> Visit
  Visit --> Interview[Interview: graph version + state]
  Interview --> Responses[InterviewResponse: raw/normalized/language/source/status/confirmation]
  Interview --> AI[AIInteraction: provider/model/validation/token/latency metadata]
  Session --> Voice[VoiceInteraction: original/normalized/edited/accepted; retained=false]
  Visit --> Voice
  Visit --> History[ClinicalHistory]
  Visit --> Symptoms[Symptom]
  Patient --> Medications[Medication]
  Patient --> Allergies[Allergy]
  Patient --> Observations[Observation]
  Visit --> Observations
  Patient --> Documents[MedicalDocument]
  Session --> Documents
  Visit --> Documents
  Documents --> Extractions[DocumentExtraction]
  Documents --> Pages[DocumentPage]
  Documents --> Facts[DocumentFact]
  Facts --> Evidence[DocumentEvidence]
  Documents --> Jobs[DocumentProcessingJob]
  Patient --> Ayush[AyushRecord]
  Visit --> Ayush
  Documents --> Ayush

  Patient --> Timeline[TimelineEvent derived index]
  Timeline --> TimelineVersions[TimelineEventVersion immutable prior projections]
  Patient --> Risk[RiskSignal storage only]
  Patient --> Snapshots[PatientSnapshot immutable comparison inputs]
  Visit --> Snapshots
  Snapshots --> Comparisons[Comparison cache/status/version]
  Comparisons --> Changes[ChangeRecord before/after/delta/evidence]
  Patient --> Briefs[ClinicalBrief version/status]
  Visit --> Briefs
  Briefs --> Claims[BriefClaim provenance/evidence]

  History --> Verification[DoctorVerification immutable decision ledger]
  Symptoms --> Verification
  Medications --> Verification
  Allergies --> Verification
  Observations --> Verification
  Facts --> Verification
  Responses --> Verification
  Ayush --> Verification
  Patient --> Audit[AuditLog metadata-minimized activity]
  Config[SystemConfig] --> Runtime[Runtime/system configuration records]

  History -. projects to .-> Timeline
  Symptoms -. projects to .-> Timeline
  Medications -. projects to .-> Timeline
  Allergies -. projects to .-> Timeline
  Observations -. projects to .-> Timeline
  Documents -. projects to .-> Timeline
  Ayush -. projects to .-> Timeline
  Verification -. updates projection .-> Timeline
  Timeline -. source bundle for .-> Snapshots
  Comparisons -. source for .-> Briefs
```

## 15. Security, privacy, provenance, and observability

```mermaid
flowchart TD
  Untrusted[All browser input is untrusted] --> Validation[Zod + upload validators]
  Validation --> Identity{Access class}
  Identity --> Patient[Opaque HMAC session proof]
  Identity --> Doctor[Signed doctor proof + active role]
  Identity --> Public[Registry/health public reads]
  Patient --> Ownership[Server resolves session -> patient -> visit ownership]
  Doctor --> Role[Server resolves actor; ignores browser-supplied doctor identity]
  Ownership --> Least[Least-necessary service operation]
  Role --> Least
  Public --> Least
  Least --> Transaction[Repository query/transaction]
  Transaction --> Provenance[Always retain source type and original value]
  Provenance --> VerifyState[Verification state is independent from source]
  VerifyState --> DTO[Serializer exposes only allowed data]
  DTO --> Response[Standard success/error envelope]

  Secrets[DATABASE_URL/API keys/session secrets] --> ServerOnly[Server environment only]
  ServerOnly -. never NEXT_PUBLIC .-> Browser[Browser]
  Upload[Audio/document bytes] --> Limits[Size/type/signature/timeout/path controls]
  Limits --> Private[Audio discarded; documents private]
  Logs[Structured Pino logs] --> Redact[Redact auth/cookies/bodies/patient-shaped fields]
  Redact --> Metadata[Keep requestId/method/path/status/duration/provider status]
  Mutation[Clinical mutation] --> Audit[Immutable or append-oriented audit/verification records]
  Audit --> NoPHI[Metadata minimized; avoid clinical text]
  Error[Operational failure] --> SafeError[Stable code + requestId; no production stack]
  Unknown[Unknown/uncertain/conflicting evidence] --> ExplicitState[UNKNOWN/CONFLICT/NEEDS_REVIEW]
  ExplicitState -. never coerced to .-> Reassurance[negative, verified, or safe]
```

## 16. Synthetic data and reference-intelligence pipeline

```mermaid
flowchart TD
  References[Read-only reference packages] --> Analysis[Independent analyses]
  References --> OpenEMR[OpenEMR: encounter/API/provenance patterns]
  References --> OpenMRS[OpenMRS: concept + typed observation patterns]
  References --> Synthea[Synthea: deterministic synthetic record/export patterns]
  References --> MTS[MTS-Dialog: conversation/summary evaluation structure]
  References --> Indic[Indic speech: language/script/code-mix metadata]
  OpenEMR --> Plan[HELIOS integration plan; no source code copied]
  OpenMRS --> Plan
  Synthea --> Plan
  MTS --> Plan
  Indic --> Plan
  Analysis --> Plan

  Seed[Seed 26047 + fixed reference timestamp] --> Generator[scripts/generate-helios-dataset.mjs]
  Generator --> Patients[1,000 synthetic patients]
  Patients --> Visits[3,000 visits]
  Visits --> Facts[15,000 facts]
  Visits --> Summaries[3,000 summaries]
  Visits --> Conversations[3,000 conversations / 18,000 utterances]
  Visits --> Docs[1,000 document records + 11 binary Phase 6 fixtures]
  Visits --> Timeline[7,000 timeline events]
  Visits --> Eval[3,000 evaluation cases + speech/comparison/verification sets]
  Patients --> Split[Patient-level deterministic split before derived artifacts]
  Split --> Train[790 patients train]
  Split --> Validation[119 patients validation]
  Split --> Test[91 patients test]
  Facts --> Exports[JSON/JSONL/CSV + lightweight FHIR-compatible NDJSON fixtures]
  Summaries --> Validator[scripts/validate-helios-dataset.mjs]
  Conversations --> Validator
  Docs --> Validator
  Timeline --> Validator
  Eval --> Validator
  Exports --> Validator
  Validator --> Checks[Schema, counts, IDs, references, dates, order, split isolation, required difficult cases]
  Checks --> Pass[PASS; synthetic only; no model weights]
```

## 17. Developer quality and delivery flow

```mermaid
flowchart LR
  Clone[Workspace checkout] --> Install[pnpm install]
  Install --> Env[Copy .env.example to .env]
  Env --> DB[(Start PostgreSQL 15+)]
  DB --> Generate[pnpm db:generate]
  Generate --> Migrate[pnpm db:migrate]
  Migrate --> Seed[pnpm db:seed: synthetic demo data]
  Seed --> Dev[pnpm dev: web 3000 + API 5000]

  Change[Code/schema/resource change] --> Format[pnpm format / format:check]
  Format --> Lint[pnpm lint]
  Lint --> Types[pnpm typecheck]
  Types --> Locale[pnpm locales:validate]
  Locale --> PrismaValidate[pnpm db:validate]
  PrismaValidate --> Fixtures[pnpm document-fixtures:generate]
  Fixtures --> Tests[pnpm test]
  Tests --> APIResult[API: 208 passed; 5 DB-gated skipped at Phase 12 verification]
  Tests --> WebResult[Web: 26 passed]
  APIResult --> Build[pnpm build]
  WebResult --> Build
  Build --> SharedBuild[Compile @helios/shared]
  SharedBuild --> APIBuild[Compile Express API]
  APIBuild --> WebBuild[Next.js optimized production build, 18 routes]
  WebBuild --> Done[Phase completion report + explicit limitations]
```

## 18. Phase evolution and current boundary

```mermaid
flowchart LR
  P0[Phase 0: workspace, config, health, logging, security foundation] --> P12[Phases 1-2: schema, repositories, patient journey]
  P12 --> P3[Phase 3: voice capture, transcription, patient confirmation]
  P3 --> P4[Phase 4: deterministic adaptive interview + bounded NLU]
  P4 --> Ref[Reference intelligence + synthetic dataset engineering]
  Ref --> Gap[Phase 5 SafetyEngine: not implemented]
  Ref --> P6[Phase 6: Document AI]
  P6 --> P7[Phase 7: longitudinal timeline]
  P7 --> P8[Phase 8: What Changed]
  P8 --> P9[Phase 9: Clinical Brief]
  P9 --> P10[Phase 10: doctor verification]
  P10 --> P11[Phase 11: AYUSH integration]
  P11 --> P12M[Phase 12: multilingual language layer]
  P12M --> Current[Current repository]
  Gap -. explicit unresolved dependency .-> Current
  Current -. not started .-> P13[Phase 13+]
```

## 19. What the system deliberately does not do

```mermaid
flowchart TD
  Captured[Patient-reported, document-extracted, and doctor-entered information] --> Organize[Organize, normalize conservatively, preserve provenance]
  Organize --> Human[Show patient confirmation and doctor verification]
  Organize -. no .-> Diagnose[Diagnosis]
  Organize -. no .-> Prescribe[Prescription or treatment recommendation]
  Organize -. no .-> Emergency[Emergency declaration or autonomous triage]
  Organize -. no .-> RiskEngine[Phase 5 safety/risk calculation]
  Organize -. no .-> Causality[Causal inference]
  Organize -. no .-> Interaction[Drug or AYUSH interaction inference]
  Organize -. no .-> Efficacy[AYUSH efficacy assessment]
  Organize -. no .-> AutoVerify[Model-initiated verification]
  Organize -. no .-> Compliance[Medical-device/regulatory compliance claim]
  Organize -. no .-> ProductionAuth[Production clinician identity/care-team authorization]
  Organize -. no .-> Exchange[Production FHIR/ABDM exchange]
```
