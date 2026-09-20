# HELIOS — presentation diagrams

Solid arrows show current data flow. Text marked **NEXT** is not implemented. These are product/implementation diagrams, not clinical decision pathways.

## 1. Product architecture

```mermaid
flowchart LR
 P[Patient routes · Next.js] -->|signed patient proof| A[Express API]
 D[Doctor routes · same web deployment] -->|signed doctor proof| A
 A --> C[Authorization · validation · services]
 C --> DB[(PostgreSQL · Prisma)]
 C --> FS[Private local document storage]
 C --> AD[Optional speech / NLU / OCR adapters]
```

## 2. Patient flow

```mermaid
flowchart LR
 L[Language + consent] --> I[Speak or type]
 I --> Q[Adaptive questions]
 Q --> X[Optional document + candidate review]
 X --> R[Review and submit]
 R --> T[Backend token]
 T --> W[Waiting status · polling]
```

## 3. Doctor flow

```mermaid
flowchart LR
 S[Demo doctor sign-in] --> Q[Authorized queue]
 Q --> C[Call / start]
 C --> B[Clinical Brief]
 B --> E[Sources · timeline · What Changed]
 E --> V[Verify / correct / reject / uncertain]
 V --> F[Complete consultation]
```

## 4. Processing pipeline

```mermaid
flowchart LR
 T[Typed or confirmed transcript] --> N[Bounded NLU · rules default]
 N --> I[Deterministic interview]
 I --> F[Source-labelled facts]
 X[PDF/image upload] --> O[Mock/local OCR + conservative extraction]
 O --> F
 F --> L[Timeline]
 F --> C[What Changed]
 F --> B[Clinical Brief]
 L --> D[Doctor review]
 C --> D
 B --> D
 D --> V[Doctor verification]
 S[SafetyEngine · NEXT] -.-> D
```

## 5. Security boundary

```mermaid
flowchart TB
 P[Patient browser] -->|patient proof| API[API authn/authz + object checks]
 D[Doctor browser] -->|doctor proof| API
 API --> DB[(Clinical records)]
 API --> FS[Authorized private file route]
 PR[Presenter + confirmation] --> G[Demo reset guard]
 G -->|local synthetic only| DEMO[(helios_sih_demo)]
```

## 6. Honest demo flow

```mermaid
flowchart LR
 S[Verify synthetic baseline] --> P[Patient Hindi consent + typed input]
 P --> Q[Questions + optional document]
 Q --> T[Submit + backend token]
 T --> D[Doctor queue + call]
 D --> B[Brief · comparison · evidence]
 B --> V[One explicit verification]
 V --> C[Close: doctor decides]
 F[If provider fails] -.->|disclose + typed or seeded fallback| B
```

