# Language registry

`packages/shared/src/language.ts` defines codes, native and English names, direction, support state, and capabilities. English (`en`) and Hindi (`hi`) are `SUPPORTED`. Tamil, Telugu, Marathi, Bengali, Gujarati, Kannada, Malayalam, Punjabi, Odia, and Urdu are visible only as `COMING_SOON`; Urdu is marked RTL for future layout work.

Unknown or disabled codes are rejected at API boundaries. The default migration fallback is English. A locale cannot be advertised as supported without UI resources and validator parity.
