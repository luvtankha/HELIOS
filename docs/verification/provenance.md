# Verification provenance

Verification never changes origin. Source values remain patient reported, AI structured, document extracted, doctor entered where supported, or system generated. The doctor decision is a separate verification state and immutable action.

Document evidence retains document, fact, page, excerpt, bounding box, and extraction confidence. Interview evidence retains question identifier, raw answer, language, normalized value, confidence, and response time. Doctor comments are separate from original source text.

The current structured value can change after correction, but `DoctorVerification.originalValue`, prior actions, document `originalValue`, evidence references, and timeline versions preserve history. Rebuild reads source facts plus their current verification state and immutable action events.

“Doctor verified” means an authorized doctor explicitly confirmed the recorded information. It is not “AI verified,” clinical accuracy certification, diagnosis, or prognosis.
