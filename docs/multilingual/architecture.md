# Multilingual architecture

Phase 12 adds one language layer shared by patient UI, interview, voice, documents, timeline, comparison, brief, verification, and AYUSH views. The flow is deliberately three-part: immutable original content, language-neutral structured facts, and a replaceable display translation. Translation never overwrites evidence.

The shared registry is the authority for availability and direction. API services own detection, normalization, and translation; clients only select a supported display language and render returned metadata. Unsupported input is preserved and routed to fallback or clarification.
