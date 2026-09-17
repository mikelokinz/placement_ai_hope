from collections.abc import Callable

from pydantic import BaseModel, Field, ValidationError, model_validator  # noqa: F401


class FailedRule(BaseModel):
    rule_id: int
    rule: str
    actual: str | float


class EligibilityVerdict(BaseModel):
    student_id: str = Field(pattern=r"^\d{2}[A-Z]{2}\d{3}$")
    drive_id: int
    eligible: bool
    failed_rules: list[FailedRule]
    summary: str = Field(min_length=1, max_length=280)

    @model_validator(mode="after")
    def check_eligible_agreement(self) -> "EligibilityVerdict":
        has_failed = len(self.failed_rules) > 0
        if self.eligible == has_failed:
            raise ValueError(f"eligible flag contradicts failed_rules: eligible={self.eligible} but failed_rules count is {len(self.failed_rules)}")
        return self


class VerdictInvalid(Exception):
    def __init__(self, attempts: int, last_errors: list):
        super().__init__(f"no valid verdict after {attempts} attempts")
        self.attempts = attempts
        self.last_errors = last_errors


Generate = Callable[[list[str]], str]


def _strip_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else ""
        t = t.rsplit("```", 1)[0]
    return t.strip()


def structured_verdict(generate: Generate, prompt: str, max_retries: int = 2) -> EligibilityVerdict:
    """Ask the model for an EligibilityVerdict; feed validation errors back; give up after max_retries."""
    messages = [prompt]
    last_errors = []
    for _ in range(1 + max_retries):
        raw = generate(messages)
        try:
            cleaned = _strip_fences(raw)
            return EligibilityVerdict.model_validate_json(cleaned)
        except (ValidationError, Exception) as e:
            last_errors = e.errors() if isinstance(e, ValidationError) else [str(e)]
            messages.append(raw)
            messages.append(f"Your reply failed validation ({e}). Ensure eligible flag does not contradicts failed_rules.")
    raise VerdictInvalid(1 + max_retries, last_errors)

