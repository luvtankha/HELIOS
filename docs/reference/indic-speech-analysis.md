# Doctor–Patient Indic Speech reference analysis

## Scope inspected

The package contains one conversation per listed Indic language, paired MP3/native transcript paths, one shared English reference path per manifest row, and two-speaker metadata. Native and English examples were inspected for turn-taking and code-mixing patterns. No transcript or audio content was copied into HELIOS output.

## Useful concepts

- Preserve selected language, detected language, transcript language, and English normalization separately.
- Maintain audio-to-transcript manifest links and explicit two-speaker roles.
- Evaluate native-script input separately from romanized/code-mixed input.
- Retain original orthography while producing language-neutral structured facts.
- Record audio container, channels, sample rate, duration, and processing version when available.

## Coverage findings

The reference lists Hindi, Tamil, Telugu, Malayalam, Kannada, Marathi, Gujarati, Bengali, and Punjabi. It is useful as a format/pattern reference but too small for performance claims: the inspected manifest has nine rows, no turn timestamps, no utterance-level audio segmentation, and no robust speaker labels in transcript lines. The shared English reference filename also requires careful alignment checks.

## HELIOS adaptation

Phase 4 remains English/Hindi/Hinglish. The generated evaluation corpus adds original synthetic utterances only in those supported languages while schemas reserve broader BCP-47 language tags, script, code-mixed status, speaker, and optional timing. Future speech evaluation should report word/character error rate by language and script, semantic fact accuracy after ASR, diarization error rate, and code-mixed subsets independently.

## What not to infer

Do not claim nine conversations represent Indic clinical speech, regional accents, or real clinical prevalence. Do not train on this package in this phase. Do not inherit clinician diagnosis/treatment statements as HELIOS patient-facing behavior.
