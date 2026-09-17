# Part 3 — memory design notes

### 1. Which entities were hiding in the Day 1 ConversationStore?
- **`thread`**: A distinct conversation session between a specific student and the placement assistant.
- **`message`**: The user-facing conversational turns (`user` or `model` messages) displayed in chat history.
- **`run`**: The agent execution workflow triggered by a single user prompt to generate a final response.
- **`run_step`**: The individual sequence of atomic events inside a run (either a `model` generation or a `tool` execution).
- **`tool_call`**: The telemetry for a tool execution step (function name, input arguments, JSON results, success status, and execution latency).

---

### 2. What is a run, and why is it not a message?
A **message** is a conversational artifact that represents communication between the student and the assistant.
A **run** is the agent's internal operational lifecycle required to produce that response.

Within a single run:
- The agent may invoke the LLM multiple times.
- The agent may execute multiple tool calls sequentially or in parallel.
- The run tracks total token consumption (`tokens_in`, `tokens_out`), execution errors, and lifecycle status (`running`, `succeeded`, `failed`).

If a run fails halfway through (e.g., due to an API timeout after an application was already created), the run record preserves the complete execution trace even though no final `model` message was generated.

---

### 3. Why is tool_call one-to-one with run_step?
Every `run_step` of kind `'tool'` corresponds to exactly one discrete tool invocation. Separating the general step metadata (`run_id`, `seq`, `kind`, `created_at`) from the tool-specific execution details (`tool_name`, `args`, `result`, `ok`, `latency_ms`) keeps the schema normalized while enforcing that each step has one clear, auditable tool payload.

---

### 4. Why does the agent's memory live apart from the placement data, and what breaks if you put them together?
The college's placement database is the **system of record** for official placement business logic (students, drives, applications, slots). The agent's memory is **operational telemetry** for chat history, traces, and LLM metrics.

#### Concrete Failures if combined:
1. **Transaction Contention & Lock Collisions**: Logging high-frequency LLM tokens and intermediate step traces on the same database tables would cause write locks that block time-sensitive operations like `book_interview_slot` or `apply_to_drive`.
2. **Blast Radius & Data Loss**: Rolling back or purging debug telemetry / chat history could corrupt or drop student application and interview booking records.
3. **Security & Boundary Violation**: The placement database enforces strict compliance and student privacy rules. The agent must interact with enterprise data strictly through governed API tools rather than having raw schema access.
