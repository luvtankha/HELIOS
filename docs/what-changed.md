# What Changed

What Changed is an implemented doctor-only deterministic comparison. The service creates immutable `PatientSnapshot`s for previous/current visits, normalizes and matches supported facts, performs field comparisons, and persists `ChangeRecord`s with `NEW`, `REMOVED`, `CHANGED`, `UNCHANGED`, `CONFLICTED`, `UNKNOWN`, `NOT_COMPARABLE`, or `NEWLY_CAPTURED` semantics plus confidence, review need and evidence. Cache keys/source revisions expose stale inputs. No LLM independently invents a change.

See [overview](comparison/01-overview.md), [normalization/matching](comparison/03-normalization-and-matching.md), [semantics](comparison/04-change-semantics.md), [API/security](comparison/05-api-and-security.md), and [testing](comparison/07-testing-and-operations.md).
