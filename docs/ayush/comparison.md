# What Changed integration

The existing snapshot builder maps `AYUSH_TREATMENT` to `AYUSH_RECORD`. Phase 8 can therefore report newly captured, changed, removed, conflicted, unknown, or unchanged AYUSH information with the same source and verification evidence used for other facts.

The comparison describes recorded information only. It does not label a change as improvement, worsening, efficacy, or harm. Adding an AyushRecord marks active comparisons stale so the next regeneration uses the current source state.
