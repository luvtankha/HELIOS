# Multilingual voice

Voice requests use the selected session language and persist detected-language metadata returned by the speech adapter. Local detection supplements provider metadata for English/Hindi code-switching. A mismatch is rejected when a session explicitly fixes a different supported language.

Uncertain speech remains subject to the existing patient confirmation step. A TTS provider contract exists, but Phase 12 does not advertise TTS as available. Audio limits, private storage rules, and transcript provenance are unchanged.
