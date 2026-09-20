# Clinical normalization

The deterministic normalizer maps approved English, Hindi, and common Romanized-Hindi phrases to stable concept IDs. It handles supported negation, numeric duration and severity, and mixed phrases such as `pet mein three days se pain hai`.

Ambiguous statements produce `needsClarification` instead of an invented fact. This is conservative extraction, not diagnosis, coding advice, or a clinically validated natural-language model.
