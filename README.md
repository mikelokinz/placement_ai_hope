# 🎓 Placement Assistant AI

> **An Agentic Career Assistant powered by Google Gemini, SQLite Telemetry, and Tool Calling.**

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/pytest-89%20passed-success.svg)](https://pytest.org/)
[![Model](https://img.shields.io/badge/LLM-Gemini%203.6%20Flash-orange.svg)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#)

Placement Assistant is an autonomous, tool-augmented AI agent built for college placement cells. It evaluates eligibility criteria against authoritative institutional data, registers drive applications, reserves interview slots, sends urgent student alerts, and maintains auditable conversational memory that survives program restarts.

---

## ✨ Features

- 🛠️ **Deterministic Tool Calling**: The model queries institutional databases through typed, validated tools rather than hallucinating eligibility decisions.
- 🔁 **Self-Healing Agent Trajectory**: Error states and bad arguments are fed back as contextual hints, allowing the model to recover autonomously without crashing.
- 💾 **Auditable SQLite Memory**: Persists complete execution traces (`thread`, `message`, `run`, `run_step`, `tool_call`) with database-enforced append-only immutability triggers.
- 🌐 **Modern Glassmorphic Web UI**: Interactive dashboard with real-time step telemetry, token accounting, student persona switcher, and 1-click slot bookings.
- ⚡ **Mock & Live Modes**: Seamlessly switch between a zero-quota deterministic mock provider for testing and live Google Gemini API in production.

---

## 🏗️ Architecture & Tools

```
               ┌───────────────────────────────┐
               │    Student / Web UI / CLI     │
               └───────────────┬───────────────┘
                               │
                               ▼
               ┌───────────────────────────────┐
               │         Agent Loop            │
               │      (app/agent.py)           │
               └───────┬───────────────┬───────┘
                       │               │
        Telemetry & Runs               │ Function Calls
                       │               │
                       ▼               ▼
           ┌──────────────────────┐  ┌──────────────────────────────┐
           │ ConversationStore    │  │ PlacementTools               │
           │ (SQLite: agent.db)   │  │ (app/tools/placement_tools)  │
           └──────────────────────┘  └───────────────┬──────────────┘
                                                     │
                                                     ▼
                                     ┌──────────────────────────────┐
                                     │ Placement Data System        │
                                     │ (Students, Drives, Slots)    │
                                     └──────────────────────────────┘
```

| Tool Name | Type | Description |
|---|---|---|
| `get_student` | Read-only | Retrieves student profile, branch, CGPA, backlogs, and graduation year. |
| `list_open_drives` | Read-only | Lists all open drives filtered by branch and graduation year. |
| `check_eligibility` | Read-only | Evaluates drive eligibility rules and returns explicit passed/failed checks. |
| `list_my_applications` | Read-only | Retrieves applied companies and booked interview timings. |
| `apply_to_drive` | Side effect | Submits an application and returns remaining available interview slots. |
| `book_interview_slot` | Side effect | Claims an interview slot, handling race conditions gracefully (`slot_taken`). |
| `notify_student` | Side effect | Dispatches SMS/email alerts to the student's phone outbox (max 160 chars). |

---

## 🚀 Quickstart

### 1. Clone & Setup Environment

```bash
# Clone the repository
git clone https://github.com/your-username/placement-assistant.git
cd placement-assistant

# Create and activate virtual environment
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and provide your Gemini API key:

```bash
# Windows PowerShell
$env:GEMINI_API_KEY = "your-gemini-api-key"
$env:GEMINI_MODEL = "gemini-3.6-flash"

# Linux / macOS
export GEMINI_API_KEY="your-gemini-api-key"
export GEMINI_MODEL="gemini-3.6-flash"
```

*(Note: API keys are not required if running in `--mock` mode or running test suites.)*

---

## 🖥️ Running the Application

### Option A: Launch the Web UI Dashboard (Recommended)

Start the built-in HTTP server:

```bash
python -m app.web_server 8000
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

### Option B: Terminal CLI Chat

```bash
# 1. Talk to agent in Mock Mode (offline, zero quota)
python -m scripts.chat --mock

# 2. Talk to agent using live Gemini API
python -m scripts.chat

# 3. Talk with persistent SQLite memory
python -m scripts.chat --db agent.db

# 4. Act as a specific student persona
python -m scripts.chat --student 22IT017 --db agent.db
```

---

## 🧪 Testing

Run the full pytest suite (89 automated tests spanning tools, loops, schemas, memory, and validation):

```bash
pytest
```

---

## 📂 Project Structure

```
placement-assistant/
├── app/
│   ├── agent.py               # Core Agent loop, step telemetry & error recovery
│   ├── data.py                # Placement domain data store
│   ├── domain.py              # Domain dataclasses (Student, Drive, Rule, Slot)
│   ├── memory.py              # ConversationStore SQLite driver & pagination
│   ├── notify.py              # Outbox notifier implementation
│   ├── providers.py           # GeminiProvider & ScriptedProvider
│   ├── verdict.py             # Pydantic typed verdict & validation retry loop
│   ├── web_server.py          # Lightweight REST API & Web server
│   └── tools/
│       ├── dispatch.py        # Safe tool calling & type coercion
│       └── placement_tools.py # 7 placement cell tools
├── docs/
│   ├── lab1_ab.md             # A/B description prompt evaluation report
│   └── part3_design.md        # Architectural memory design document
├── schema/
│   ├── agent.sql              # Memory schema (thread, message, run, run_step, tool_call)
│   └── append_only.sql        # SQLite immutability triggers (UPDATE / DELETE abort)
├── scripts/
│   ├── ab_descriptions.py     # Prompt differentiation benchmark runner
│   └── chat.py                # Terminal interactive chat client
├── tests/                     # 89 pytest test cases
├── ui/                        # Web dashboard frontend (HTML5, CSS3, ES6)
├── HANDOUT.html               # Lab specification & learning reference
├── requirements.txt           # Project dependencies
└── README.md
```

---

## 📄 License

This project is licensed under the MIT License.
