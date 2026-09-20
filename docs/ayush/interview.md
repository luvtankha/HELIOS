# AYUSH interview

The Phase 4 graph adds one English/Hindi screening question after the core complaint history. An explicit no ends the branch. Yes activates short questions for system, treatment/medicine name, who recommended it, start time, current/past/stopped state, and any new symptom reported after starting.

Each response still uses the existing confirmation and revision workflow. English, Hindi, and supported original-language text are preserved; the database system enum is language-independent. “Some Ayurvedic medicine” becomes `NOT_SPECIFIED`, never a guessed product.

Voice answers use the existing voice/transcript path. Audio is not persisted by the current voice subsystem.
