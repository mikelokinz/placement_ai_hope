"""Modern Web Server & REST API for the Placement Assistant.

Serves the interactive web UI and connects the frontend to the live Agent,
tools, memory, and database.
"""
import json
import os
import sys
import traceback
from datetime import datetime, timezone
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from app.agent import Agent
from app.data import InMemoryPlacementRepo
from app.memory import ConversationStore
from app.notify import OutboxNotifier
from app.providers import AgentError, GeminiProvider, default_mock
from app.tools.placement_tools import PlacementTools

ROOT_DIR = Path(__file__).resolve().parent.parent
UI_DIR = ROOT_DIR / "ui"
DB_PATH = str(ROOT_DIR / "agent.db")

# Global instances
repo = InMemoryPlacementRepo()
notifier = OutboxNotifier()
tools = PlacementTools(repo, notifier)
memory = ConversationStore(DB_PATH)
memory.migrate()


class PlacementRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(UI_DIR), **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _send_json(self, data: dict | list, status: int = 200):
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/api/students":
            students = [
                {
                    "student_id": s.roll_no,
                    "name": s.name,
                    "branch": s.branch,
                    "cgpa": s.cgpa,
                    "backlogs": s.backlogs,
                    "grad_year": s.grad_year,
                }
                for s in repo.students.values()
            ]
            return self._send_json({"students": students})

        if path == "/api/drives":
            student_id = query.get("student_id", ["22CS045"])[0]
            student = repo.get_student(student_id)
            drives_data = []
            for d in repo.drives.values():
                rules = repo.rules_for_drive(d.id)
                failed = []
                if student:
                    for rule in rules:
                        val = getattr(student, rule.field, None)
                        from app.tools.placement_tools import _passes
                        if not _passes(rule, val):
                            failed.append({"rule_id": rule.id, "rule": str(rule), "actual": val})

                has_app = False
                if student:
                    has_app = repo.has_application(student.id, d.id)

                free_slots = repo.free_slots(d.id)
                drives_data.append({
                    "drive_id": d.id,
                    "company": d.company,
                    "role": d.role,
                    "ctc_lpa": d.ctc_lpa,
                    "deadline": d.deadline.strftime("%Y-%m-%d"),
                    "status": d.status,
                    "is_open": d.status == "open" and d.deadline > datetime.now(timezone.utc),
                    "eligible": not failed,
                    "failed_rules": failed,
                    "has_applied": has_app,
                    "free_slots": [{"slot_id": s.id, "starts_at": s.starts_at.isoformat()} for s in free_slots],
                })
            return self._send_json({"drives": drives_data})

        if path == "/api/applications":
            student_id = query.get("student_id", ["22CS045"])[0]
            student = repo.get_student(student_id)
            if not student:
                return self._send_json({"applications": []})
            apps = tools.list_my_applications(student_id)
            return self._send_json(apps)

        if path == "/api/threads":
            student_id = query.get("student_id", [None])[0]
            if student_id:
                rows = memory.conn.execute(
                    "SELECT * FROM thread WHERE student_id = ? ORDER BY created_at DESC", (student_id,)
                ).fetchall()
            else:
                rows = memory.conn.execute("SELECT * FROM thread ORDER BY created_at DESC").fetchall()
            return self._send_json({"threads": [dict(r) for r in rows]})

        if path.startswith("/api/thread/"):
            parts = path.strip("/").split("/")
            if len(parts) >= 3 and parts[2] == "messages":
                thread_id = parts[1]
                history = memory.load_history(thread_id)
                # fetch runs for this thread
                runs = memory.conn.execute(
                    "SELECT id FROM run WHERE thread_id = ? ORDER BY started_at ASC", (thread_id,)
                ).fetchall()
                detailed_runs = [memory.get_run(r["id"]) for r in runs if r["id"]]
                return self._send_json({"history": history, "runs": detailed_runs})

        if path == "/" or not (UI_DIR / path.lstrip("/")).exists():
            self.path = "/index.html"

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            body = json.loads(raw_body)
        except Exception:
            body = {}

        if path == "/api/chat":
            student_id = body.get("student_id", "22CS045")
            text = body.get("message", "").strip()
            use_mock = body.get("use_mock", False)
            thread_id = body.get("thread_id")

            if not text:
                return self._send_json({"error": "Empty message"}, status=400)

            if not thread_id:
                thread_id = memory.create_thread(student_id)

            api_key = os.environ.get("GEMINI_API_KEY")
            if not use_mock and not api_key:
                use_mock = True

            provider = default_mock() if use_mock else GeminiProvider(os.environ.get("GEMINI_MODEL", "gemini-3.6-flash"))

            trace = []
            def on_step(entry):
                trace.append(dict(entry))

            try:
                agent = Agent(provider, tools, student_id, memory=memory, thread_id=thread_id, on_step=on_step)
                reply = agent.ask(text)
                return self._send_json({
                    "reply": reply,
                    "thread_id": thread_id,
                    "trace": trace,
                    "mode": "mock" if use_mock else "gemini",
                })
            except AgentError as e:
                return self._send_json({
                    "error": e.code,
                    "message": e.message,
                    "trace": trace,
                    "thread_id": thread_id,
                }, status=500)
            except Exception as e:
                traceback.print_exc()
                return self._send_json({
                    "error": "server_error",
                    "message": str(e),
                    "trace": trace,
                    "thread_id": thread_id,
                }, status=500)

        if path == "/api/apply":
            student_id = body.get("student_id")
            drive_id = int(body.get("drive_id", 0))
            result = tools.apply_to_drive(student_id, drive_id)
            return self._send_json(result)

        if path == "/api/book":
            student_id = body.get("student_id")
            slot_id = int(body.get("slot_id", 0))
            result = tools.book_interview_slot(student_id, slot_id)
            return self._send_json(result)

        return self._send_json({"error": "Not Found"}, status=404)


def run(port: int = 8000):
    server = HTTPServer(("127.0.0.1", port), PlacementRequestHandler)
    print(f"🚀 Placement Assistant Web UI running at http://127.0.0.1:{port}")
    print(f"   Database: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        server.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run(port)
