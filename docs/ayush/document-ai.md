# AYUSH Document AI

The Phase 6 OCR/classification pipeline is reused. The conservative rule extractor recognizes explicitly written AYUSH system terms and emits `ayush_treatment` DocumentFacts with existing confidence and page/region evidence. It does not infer ingredients, biomedical diagnoses, current use, practitioner registration validity, or a product identity that is absent.

An AYUSH projector converts eligible document facts to source-linked AyushRecords. Low-confidence items need review. Rejected/removed document facts supersede the active derived AYUSH record without deleting source evidence. The Phase 6 EvidenceViewer remains the document review surface in the Verification Center.
