import unittest

from helios_voice_bench.runtime.forced_questions import ApprovedQuestion, ForcedQuestionPlan


class FakeTensor:
    def __init__(self) -> None:
        self.value = None

    def fill_(self, value: int) -> None:
        self.value = value


class ForcedQuestionPlanTests(unittest.TestCase):
    def test_forces_only_approved_tokens_in_order(self) -> None:
        plan = ForcedQuestionPlan()
        plan.enqueue(
            ApprovedQuestion(
                question_id="q1",
                text="Kab se?",
                token_ids=(11, 22, 33),
            )
        )
        tensor = FakeTensor()

        self.assertTrue(plan.apply_to_tensor(tensor))
        self.assertEqual(11, tensor.value)
        self.assertTrue(plan.apply_to_tensor(tensor))
        self.assertEqual(22, tensor.value)
        self.assertTrue(plan.apply_to_tensor(tensor))
        self.assertEqual(33, tensor.value)
        self.assertFalse(plan.apply_to_tensor(tensor))

    def test_barge_in_clears_remaining_question(self) -> None:
        plan = ForcedQuestionPlan()
        plan.enqueue(
            ApprovedQuestion(
                question_id="q1",
                text="Long question",
                token_ids=(1, 2, 3),
            )
        )
        self.assertEqual(1, plan.next_forced_token())
        plan.cancel()
        self.assertIsNone(plan.next_forced_token())
        self.assertEqual(0, plan.pending())

    def test_rejects_empty_or_invalid_approved_question(self) -> None:
        plan = ForcedQuestionPlan()
        with self.assertRaises(ValueError):
            plan.enqueue(ApprovedQuestion("q1", "", (1,)))
        with self.assertRaises(ValueError):
            plan.enqueue(ApprovedQuestion("q1", "Valid text", ()))
        with self.assertRaises(ValueError):
            plan.enqueue(ApprovedQuestion("q1", "Valid text", (-1,)))


if __name__ == "__main__":
    unittest.main()
