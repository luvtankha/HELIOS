# Translation

Translation uses a provider interface and versioned approved resources. Static workflow messages and interview questions may be translated; arbitrary clinical source content falls back to the original when no approved mapping exists. Batch translation preserves item order and exposes provider/fallback metadata.

Translation is for display only. It cannot change a canonical concept, evidence span, verification status, urgency state, or source text. Provider telemetry excludes patient text.
