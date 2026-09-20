# Multilingual data model

The additive migration stores patient and doctor preference plus content metadata. Interview responses retain `originalLanguage`, detected languages, display language, and optional display text. Voice interactions retain detected languages. Medical documents and document facts retain document/original language and optional display translation.

Existing rows remain valid through nullable metadata and English defaults. Canonical facts, provenance, verification records, and immutable source text remain independent of display language. No translated string is promoted to source evidence.
