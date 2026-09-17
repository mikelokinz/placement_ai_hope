// Placement Assistant AI - Frontend Controller

let currentStudentId = "22CS045";
let currentThreadId = null;
let useMock = false;

// DOM Elements
const studentSelect = document.getElementById("studentSelect");
const studentName = document.getElementById("studentName");
const studentRoll = document.getElementById("studentRoll");
const studentAvatar = document.getElementById("studentAvatar");
const statCgpa = document.getElementById("statCgpa");
const statBacklogs = document.getElementById("statBacklogs");
const statBranch = document.getElementById("statBranch");
const statBatch = document.getElementById("statBatch");
const mockToggle = document.getElementById("mockToggle");
const modeInfoText = document.getElementById("modeInfoText");
const newThreadBtn = document.getElementById("newThreadBtn");
const threadList = document.getElementById("threadList");
const activeThreadBadge = document.getElementById("activeThreadBadge");
const messagesContainer = document.getElementById("messagesContainer");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const drivesList = document.getElementById("drivesList");
const appsList = document.getElementById("appsList");
const liveTraceContainer = document.getElementById("liveTraceContainer");

// Initial Setup
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();
  
  fetchStudents();
  fetchDrives();
  fetchApplications();
  fetchThreads();

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });

  // Prompt chips
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      chatInput.value = chip.dataset.prompt;
      chatInput.focus();
    });
  });

  // Student change
  studentSelect.addEventListener("change", (e) => {
    currentStudentId = e.target.value;
    currentThreadId = null;
    updateStudentProfile();
    fetchDrives();
    fetchApplications();
    fetchThreads();
    resetChat();
  });

  // Mock toggle
  mockToggle.addEventListener("change", (e) => {
    useMock = e.target.checked;
    modeInfoText.textContent = useMock ? "Using Mock Engine (No Quota)" : "Using Real Gemini AI";
    modeInfoText.style.color = useMock ? "var(--accent-amber)" : "var(--accent-cyan)";
  });

  // New thread
  newThreadBtn.addEventListener("click", () => {
    currentThreadId = null;
    activeThreadBadge.textContent = "Thread: new";
    resetChat();
    fetchThreads();
  });

  // Chat submit
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";
    appendUserMessage(text);
    await sendChatMessage(text);
  });
});

async function fetchStudents() {
  try {
    const res = await fetch("/api/students");
    const data = await res.json();
    window.studentsData = data.students || [];
    updateStudentProfile();
  } catch (err) {
    console.error("Failed to fetch students", err);
  }
}

function updateStudentProfile() {
  const students = window.studentsData || [];
  const s = students.find(item => item.student_id === currentStudentId);
  if (!s) return;

  studentName.textContent = s.name;
  studentRoll.textContent = s.student_id;
  studentAvatar.textContent = s.name.split(" ").map(n => n[0]).join("");
  statCgpa.textContent = s.cgpa;
  statBacklogs.textContent = s.backlogs;
  statBranch.textContent = s.branch;
  statBatch.textContent = s.grad_year;
}

async function fetchDrives() {
  try {
    const res = await fetch(`/api/drives?student_id=${currentStudentId}`);
    const data = await res.json();
    renderDrives(data.drives || []);
  } catch (err) {
    drivesList.innerHTML = `<div class="empty-state">Failed to load drives.</div>`;
  }
}

function renderDrives(drives) {
  if (!drives.length) {
    drivesList.innerHTML = `<div class="empty-state">No drives available.</div>`;
    return;
  }

  drivesList.innerHTML = drives.map(d => {
    const eligibleClass = d.eligible ? "eligible" : "ineligible";
    const eligibleText = d.eligible ? "Eligible to Apply" : "Ineligible for this drive";

    let failedHtml = "";
    if (!d.eligible && d.failed_rules && d.failed_rules.length > 0) {
      failedHtml = `<ul class="rules-failed-list">${d.failed_rules.map(f => `<li>${f.rule} (Your value: ${f.actual})</li>`).join("")}</ul>`;
    }

    let slotsHtml = "";
    if (d.has_applied && d.free_slots && d.free_slots.length > 0) {
      slotsHtml = `
        <div class="slots-picker-area">
          <span style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Available Interview Slots:</span>
          <div class="slots-chips">
            ${d.free_slots.map(s => {
              const dt = new Date(s.starts_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
              return `<button class="slot-chip" onclick="bookSlot(${s.slot_id})">${dt}</button>`;
            }).join("")}
          </div>
        </div>
      `;
    }

    return `
      <div class="drive-card">
        <div class="card-top">
          <div>
            <div class="company-title">${d.company}</div>
            <div class="role-subtitle">${d.role}</div>
          </div>
          <span class="ctc-badge">${d.ctc_lpa} LPA</span>
        </div>
        
        <div class="eligibility-status ${eligibleClass}">
          ${d.eligible ? '✓' : '✗'} ${eligibleText}
          ${failedHtml}
        </div>

        <div style="font-size:0.75rem; color:var(--text-muted);">
          Deadline: <strong>${d.deadline}</strong> | Status: <strong style="color:${d.status==='open'?'var(--accent-emerald)':'var(--accent-rose)'}">${d.status}</strong>
        </div>

        <div class="card-actions">
          ${d.has_applied 
            ? `<span style="font-size:0.78rem; font-weight:700; color:var(--accent-emerald);">✓ Applied</span>` 
            : `<button class="btn-primary" ${(!d.is_open || !d.eligible) ? 'disabled' : ''} onclick="applyToDrive(${d.drive_id})">1-Click Apply</button>`
          }
          <button class="btn-outline" onclick="askAboutDrive('${d.company}', ${d.drive_id})">Ask Agent</button>
        </div>

        ${slotsHtml}
      </div>
    `;
  }).join("");
}

async function fetchApplications() {
  try {
    const res = await fetch(`/api/applications?student_id=${currentStudentId}`);
    const data = await res.json();
    renderApplications(data.applications || []);
  } catch (err) {
    appsList.innerHTML = `<div class="empty-state">Failed to load applications.</div>`;
  }
}

function renderApplications(apps) {
  if (!apps.length) {
    appsList.innerHTML = `<div class="empty-state">No applications submitted yet.</div>`;
    return;
  }

  appsList.innerHTML = apps.map(a => `
    <div class="app-card">
      <div class="card-top">
        <div>
          <div class="company-title">${a.company}</div>
          <div class="role-subtitle">${a.role}</div>
        </div>
        <span class="badge-tag" style="background:rgba(16,185,129,0.2); color:#34d399;">${a.status}</span>
      </div>
      <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
        <div>Applied: <strong>${new Date(a.applied_on).toLocaleDateString()}</strong></div>
        <div>Interview: <strong>${a.interview_at ? new Date(a.interview_at).toLocaleString() : 'Not scheduled yet'}</strong></div>
      </div>
    </div>
  `).join("");
}

async function fetchThreads() {
  try {
    const res = await fetch(`/api/threads?student_id=${currentStudentId}`);
    const data = await res.json();
    const threads = data.threads || [];
    if (!threads.length) {
      threadList.innerHTML = `<div class="empty-state">No saved threads.</div>`;
      return;
    }
    threadList.innerHTML = threads.map(t => {
      const active = t.id === currentThreadId ? "active" : "";
      const date = new Date(t.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      return `<div class="thread-item ${active}" onclick="loadThread('${t.id}')"># ${t.id.slice(0, 8)}... (${date})</div>`;
    }).join("");
  } catch (err) {
    console.error(err);
  }
}

async function loadThread(threadId) {
  currentThreadId = threadId;
  activeThreadBadge.textContent = `Thread: ${threadId.slice(0, 8)}...`;
  fetchThreads();

  try {
    const res = await fetch(`/api/thread/${threadId}/messages`);
    const data = await res.json();
    messagesContainer.innerHTML = "";
    (data.history || []).forEach(m => {
      if (m.role === "user") appendUserMessage(m.text);
      else appendAssistantMessage(m.text);
    });

    if (data.runs && data.runs.length > 0) {
      const lastRun = data.runs[data.runs.length - 1];
      renderTrace(lastRun.steps || []);
    }
  } catch (err) {
    console.error("Failed to load thread messages", err);
  }
}

function resetChat() {
  messagesContainer.innerHTML = `
    <div class="message assistant-msg welcome-msg">
      <div class="msg-avatar"><i data-lucide="bot"></i></div>
      <div class="msg-body">
        <div class="msg-bubble">
          <p>👋 Hello <strong>${studentName.textContent}</strong>!</p>
          <p>I am your <strong>Placement Assistant</strong>. Ask me about open companies, eligibility cutoffs, or booking slots.</p>
        </div>
      </div>
    </div>
  `;
  liveTraceContainer.innerHTML = `<div class="empty-state">Ask a question to see real-time tool calls and step telemetry.</div>`;
  if (window.lucide) lucide.createIcons();
}

function appendUserMessage(text) {
  const msgEl = document.createElement("div");
  msgEl.className = "message user-msg";
  msgEl.innerHTML = `
    <div class="msg-avatar"><i data-lucide="user"></i></div>
    <div class="msg-body">
      <div class="msg-bubble">${escapeHtml(text)}</div>
    </div>
  `;
  messagesContainer.appendChild(msgEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  if (window.lucide) lucide.createIcons();
}

function appendAssistantMessage(text, trace = []) {
  const msgEl = document.createElement("div");
  msgEl.className = "message assistant-msg";

  let toolsHtml = "";
  if (trace && trace.length > 0) {
    const toolSteps = trace.filter(t => t.kind === "tool");
    if (toolSteps.length > 0) {
      toolsHtml = `
        <div class="inline-tools-list">
          ${toolSteps.map(t => `
            <div class="tool-step-chip ${t.ok ? 'ok' : 'fail'}">
              <span>🛠️ <span class="tool-name-tag">${t.tool}</span></span>
              <span class="tool-ms-tag">${t.ms} ms</span>
            </div>
          `).join("")}
        </div>
      `;
    }
  }

  msgEl.innerHTML = `
    <div class="msg-avatar"><i data-lucide="bot"></i></div>
    <div class="msg-body">
      ${toolsHtml}
      <div class="msg-bubble">${formatReply(text)}</div>
    </div>
  `;
  messagesContainer.appendChild(msgEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  if (window.lucide) lucide.createIcons();
}

async function sendChatMessage(text) {
  // Show typing loader
  const typingEl = document.createElement("div");
  typingEl.className = "message assistant-msg typing";
  typingEl.id = "typingIndicator";
  typingEl.innerHTML = `
    <div class="msg-avatar"><i data-lucide="bot"></i></div>
    <div class="msg-body">
      <div class="msg-bubble" style="color:var(--text-muted);"><i data-lucide="loader-2" class="spin"></i> Reasoning & calling tools...</div>
    </div>
  `;
  messagesContainer.appendChild(typingEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: currentStudentId,
        message: text,
        use_mock: useMock,
        thread_id: currentThreadId,
      }),
    });
    const data = await res.json();
    const ind = document.getElementById("typingIndicator");
    if (ind) ind.remove();

    if (data.thread_id) {
      currentThreadId = data.thread_id;
      activeThreadBadge.textContent = `Thread: ${currentThreadId.slice(0, 8)}...`;
      fetchThreads();
    }

    if (data.error) {
      appendAssistantMessage(`⚠️ Error: ${data.message || data.error}`, data.trace);
    } else {
      appendAssistantMessage(data.reply || "(no answer)", data.trace);
    }

    if (data.trace) {
      renderTrace(data.trace);
    }

    // Refresh state
    fetchDrives();
    fetchApplications();
  } catch (err) {
    const ind = document.getElementById("typingIndicator");
    if (ind) ind.remove();
    appendAssistantMessage(`⚠️ Request failed: ${err.message}`);
  }
}

function renderTrace(trace) {
  if (!trace || !trace.length) {
    liveTraceContainer.innerHTML = `<div class="empty-state">No trace entries for this turn.</div>`;
    return;
  }

  liveTraceContainer.innerHTML = trace.map(t => {
    const isModel = t.kind === "model";
    const badgeClass = isModel ? "model" : "tool";
    const title = isModel ? `Model Call (Tokens: in=${t.tokens_in || 0}, out=${t.tokens_out || 0})` : `Tool: ${t.tool || t.tool_name} (${t.ms || t.latency_ms || 0}ms)`;

    let detail = "";
    if (!isModel) {
      detail = `
        <div style="margin-top:4px;">
          <div style="color:var(--text-muted); font-size:0.68rem;">ARGS:</div>
          <pre class="json-view">${escapeHtml(typeof t.args === 'string' ? t.args : JSON.stringify(t.args, null, 2))}</pre>
          <div style="color:var(--text-muted); font-size:0.68rem; margin-top:4px;">RESULT:</div>
          <pre class="json-view">${escapeHtml(typeof t.result === 'string' ? t.result : JSON.stringify(t.result, null, 2))}</pre>
        </div>
      `;
    }

    return `
      <div class="trace-step-card">
        <div class="trace-step-header">
          <span class="step-num">Step ${t.seq || t.step || 1}</span>
          <span class="step-kind-badge ${badgeClass}">${t.kind.toUpperCase()}</span>
        </div>
        <div style="font-weight:600; color:#fff;">${title}</div>
        ${detail}
      </div>
    `;
  }).join("");
}

async function applyToDrive(driveId) {
  try {
    const res = await fetch("/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: currentStudentId, drive_id: driveId }),
    });
    const result = await res.json();
    if (result.status === "applied") {
      appendAssistantMessage(`✅ Successfully applied to drive ${driveId}!`);
      fetchDrives();
      fetchApplications();
    } else {
      appendAssistantMessage(`⚠️ Could not apply: ${result.error} (${result.hint || ''})`);
    }
  } catch (err) {
    console.error(err);
  }
}

async function bookSlot(slotId) {
  try {
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: currentStudentId, slot_id: slotId }),
    });
    const result = await res.json();
    if (result.status === "booked") {
      appendAssistantMessage(`🎉 Interview slot #${slotId} booked successfully!`);
      fetchDrives();
      fetchApplications();
    } else {
      appendAssistantMessage(`⚠️ Slot booking failed: ${result.error} (${result.hint || ''})`);
    }
  } catch (err) {
    console.error(err);
  }
}

function askAboutDrive(company, driveId) {
  chatInput.value = `Am I eligible for ${company}? If so, please apply me.`;
  chatInput.focus();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatReply(text) {
  if (!text) return "";
  let out = escapeHtml(text);
  out = out.replace(/\n/g, "<br>");
  return out;
}
