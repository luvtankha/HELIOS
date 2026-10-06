from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from threading import Lock
from typing import Iterable


@dataclass(frozen=True)
class ApprovedQuestion:
    question_id: str
    text: str
    token_ids: tuple[int, ...]


class ForcedQuestionPlan:
    """Queue of Java-approved text tokens for Moshi speech generation."""

    def __init__(self) -> None:
        self._questions: deque[ApprovedQuestion] = deque()
        self._active: ApprovedQuestion | None = None
        self._offset = 0
        self._lock = Lock()

    def enqueue(self, question: ApprovedQuestion) -> None:
        if not question.question_id or not question.text.strip():
            raise ValueError("approved question requires id and text")
        if not question.token_ids:
            raise ValueError("approved question produced no text tokens")
        if any(token < 0 for token in question.token_ids):
            raise ValueError("text token ids must be non-negative")
        with self._lock:
            self._questions.append(question)

    def cancel(self) -> None:
        with self._lock:
            self._active = None
            self._offset = 0
            self._questions.clear()

    def next_forced_token(self) -> int | None:
        with self._lock:
            if self._active is None:
                if not self._questions:
                    return None
                self._active = self._questions.popleft()
                self._offset = 0
            token = self._active.token_ids[self._offset]
            self._offset += 1
            if self._offset >= len(self._active.token_ids):
                self._active = None
                self._offset = 0
            return token

    def apply_to_tensor(self, sampled_text_token: object) -> bool:
        forced = self.next_forced_token()
        if forced is None:
            return False
        fill = getattr(sampled_text_token, "fill_", None)
        if not callable(fill):
            raise TypeError("sampled text token does not support in-place fill")
        fill(forced)
        return True

    def pending(self) -> int:
        with self._lock:
            return len(self._questions) + (1 if self._active is not None else 0)


def normalize_token_ids(values: Iterable[int]) -> tuple[int, ...]:
    return tuple(int(value) for value in values)
