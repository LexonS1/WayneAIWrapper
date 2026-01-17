const API_BASE = "https://wayne-relay-api.onrender.com";
const API_KEY = "dev-secret"; // OK for now (personal use)

const chat = document.getElementById("chat");
const input = document.getElementById("message");
const sendBtn = document.getElementById("send");
const cancelBtn = document.getElementById("cancel");
const status = document.getElementById("status");
const MAX_INPUT_HEIGHT = 160;
let currentJobId = null;
let currentPollTimer = null;

function autoResizeInput() {
  input.style.height = "auto";
  const nextHeight = Math.min(input.scrollHeight, MAX_INPUT_HEIGHT);
  input.style.height = `${nextHeight}px`;
  input.style.overflowY = input.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
}

function addMessage(text, who) {
  const div = document.createElement("div");
  div.className = `message ${who}`;
  const label = who === "user" ? "You" : "Wayne";
  div.innerHTML = `<span class="speaker">${label}:</span> <span class="text"></span>`;
  div.querySelector(".text").textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// Fallback for environments where key events fire but the input value doesn't update.
function ensureInputUpdates() {
  input.addEventListener("keydown", (event) => {
    if (event.isComposing || event.key === "Process") return;

    const printable =
      event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    const isBackspace = event.key === "Backspace";
    const isDelete = event.key === "Delete";

    if (!printable && !isBackspace && !isDelete) return;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const before = input.value;

    setTimeout(() => {
      if (input.value !== before) return;

      if (printable) {
        input.value = before.slice(0, start) + event.key + before.slice(end);
        input.selectionStart = input.selectionEnd = start + 1;
        autoResizeInput();
        return;
      }

      if (isBackspace) {
        if (start !== end) {
          input.value = before.slice(0, start) + before.slice(end);
          input.selectionStart = input.selectionEnd = start;
          return;
        }
        if (start > 0) {
          input.value = before.slice(0, start - 1) + before.slice(end);
          input.selectionStart = input.selectionEnd = start - 1;
        }
        autoResizeInput();
        return;
      }

      if (isDelete) {
        if (start !== end) {
          input.value = before.slice(0, start) + before.slice(end);
          input.selectionStart = input.selectionEnd = start;
          return;
        }
        if (start < before.length) {
          input.value = before.slice(0, start) + before.slice(start + 1);
          input.selectionStart = input.selectionEnd = start;
        }
        autoResizeInput();
      }
    }, 0);
  });
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  autoResizeInput();

  addMessage(text, "user");
  status.textContent = "Sending…";
  cancelBtn.disabled = true;

  const res = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId: "default",
      message: text
    })
  });

  const { jobId } = await res.json();
  currentJobId = jobId;
  cancelBtn.disabled = false;
  pollJob(jobId);
}

async function pollJob(jobId) {
  status.textContent = "Wayne is thinking…";

  if (currentPollTimer) clearInterval(currentPollTimer);
  currentPollTimer = setInterval(async () => {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`
      }
    });
    const job = await res.json();

    if (job.status === "done") {
      clearInterval(currentPollTimer);
      currentPollTimer = null;
      addMessage(job.reply, "wayne");
      status.textContent = "";
      currentJobId = null;
      cancelBtn.disabled = true;
      return;
    }
    if (job.status === "cancelled") {
      clearInterval(currentPollTimer);
      currentPollTimer = null;
      status.textContent = "Cancelled.";
      currentJobId = null;
      cancelBtn.disabled = true;
    }
  }, 250);
}

async function cancelMessage() {
  if (!currentJobId) return;
  cancelBtn.disabled = true;
  status.textContent = "Cancelling…";

  try {
    await fetch(`${API_BASE}/jobs/${currentJobId}/cancel`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`
      }
    });
  } catch {
    // Ignore cancel errors; fall back to status poll.
  }

  if (currentPollTimer) {
    clearInterval(currentPollTimer);
    currentPollTimer = null;
  }
  status.textContent = "Cancelled.";
  currentJobId = null;
}

sendBtn.onclick = sendMessage;
cancelBtn.onclick = cancelMessage;
input.onkeydown = (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};
input.addEventListener("input", autoResizeInput);
ensureInputUpdates();
autoResizeInput();
