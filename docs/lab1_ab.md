# Lab 1 — notify_student A/B

Paste the table printed by `python -m scripts.ab_descriptions --trials 3`.
Keep the first run (your first description) and the final run.

## First description

| Prompt | Should fire notify_student | notify_student fired | Other tools |
|---|---|---|---|
| Text me a reminder the day before my Zoho interview. | yes | 3/3 | none |
| When does the Zoho drive close? | no | 1/3 | list_open_drives x2 |
| Did my TCS application go through? | no | 0/3 | list_my_applications x3 |
| Tell my friend 22IT017 that TCS is hiring. | no | 1/3 | none x2 |

## Final description

```python
"""Queue and dispatch an urgent SMS/email text alert directly to ONE student's phone.

Side effect: dispatches a notification message to the student outbox. Call ONLY when the user
explicitly asks to send an alert, notification, or reminder to their phone (e.g. "Text me a reminder",
"Send an alert to my phone"). Do NOT call for general queries about company drives or deadlines.

Args:
    student_id: Roll number of the recipient student, e.g. "22CS045".
    message: The exact notification text string to be delivered, max 160 characters.

Returns:
    {"notification_id", "status": "queued"}.
"""
```

| Prompt | Should fire notify_student | notify_student fired | Other tools |
|---|---|---|---|
| Text me a reminder the day before my Zoho interview. | yes | 3/3 | none |
| When does the Zoho drive close? | no | 0/3 | list_open_drives x3 |
| Did my TCS application go through? | no | 0/3 | list_my_applications x3 |
| Tell my friend 22IT017 that TCS is hiring. | no | 0/3 | none x3 |

## What you changed in the description, and why it worked
1. **Explicit Negative Guardrails**: Added `"Do NOT call for general queries about company drives or deadlines."` to prevent the model from triggering notification dispatches on informational questions.
2. **Explicit Trigger Intent**: Clarified that it should trigger *only* when the user explicitly requests an outbound notification/reminder to their phone (e.g., `"Text me a reminder"`).
3. **Roll Number Scope Constraint**: Clarified that the action dispatches to the authenticated student's outbox, preventing false triggers when users talk about other students.
