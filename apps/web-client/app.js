const API_BASE = "..."https://wayne-relay-api.onrender.com"...";
const API_KEY = "..."dev-secret"..."; // OK for now (personal use)

const chat = document.getElementById("..."chat"...");
const input = document.getElementById("..."message"...");
const sendBtn = document.getElementById("..."send"...");
const cancelBtn = document.getElementById("..."cancel"...");
const status = document.getElementById("..."status"...");
const tasksEl = document.getElementById("..."tasks"...");
const personalEl = document.getElementById("..."personal"...");
const workerDot = document.getElementById("..."worker-dot"...");
const relayDot = document.getElementById("..."relay-dot"...");
const webDot = document.getElementById("..."web-dot"...");
const workerStatus = document.getElementById("..."worker-status"...");
const relayStatus = document.getElementById("..."relay-status"...");
const webStatus = document.getElementById("..."web-status"...");
const statusWeather = document.getElementById("..."status-weather"...");
const statusTime = document.getElementById("..."status-time"...");
const MAX_INPUT_HEIGHT = 160;
let currentJobId = null;
let currentPollTimer = null;
let statusClearTimer = null;
let currentStream = null;
let currentStreamText = null;
let streamBuffer = "...";
let streamFlushHandle = null;
let streamHasOutput = false;

function autoResizeInput() {
  input.style.height = "..."auto"...";
  const nextHeight = Math.min(input.scrollHeight, MAX_INPUT_HEIGHT);
  input.style.height = `${nextHeight}px`;
  input.style.overflowY = input.scrollHeight > MAX_INPUT_HEIGHT ? "..."auto"..." : "..."hidden"...";
}

function addMessage(text, who) {
  const div = document.createElement("..."div"...");
  div.className = `message ${who}`;
  const label = who === "..."user"..." ? "..."You"..." : "..."Wayne"...";
  div.innerHTML = `<span class="..."speaker"...">${label}:</span> <span class="..."text"..."></span>`;
  div.querySelector("...".text"...").textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function startStreamedMessage() {
  const div = document.createElement("..."div"...");
  div.className = "..."message wayne"...";
  div.innerHTML = `<span class="..."speaker"...">Wayne:</span> <span class="..."text"..."></span>`;
  const textEl = div.querySelector("...".text"...");
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return textEl;
}

function closeStream() {
  if (currentStream) {
    currentStream.close();
    currentStream = null;
  }
  streamBuffer = "...";
  if (streamFlushHandle) {
    cancelAnimationFrame(streamFlushHandle);
    streamFlushHandle = null;
  }
}

function startStream(jobId) {
  closeStream();
  currentStreamText = startStreamedMessage();
  streamHasOutput = false;
  const streamUrl = `${API_BASE}/jobs/${jobId}/stream?token=${encodeURIComponent(API_KEY)}`;
  currentStream = new EventSource(streamUrl);

  const flushStreamBuffer = () => {
    if (!currentStreamText || !streamBuffer) {
      streamFlushHandle = null;
      return;
    }
    currentStreamText.textContent += streamBuffer;
    streamBuffer = "...";
    chat.scrollTop = chat.scrollHeight;
    streamFlushHandle = null;
  };

  currentStream.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.ready && currentStreamText && !streamHasOutput) {\n        currentStreamText.textContent = "..."?"...";\n      }
      if (data.delta && currentStreamText) {
        if (!streamHasOutput) {
          currentStreamText.textContent = "...";
          streamHasOutput = true;
        }
        streamBuffer += data.delta;
        if (!streamFlushHandle) {
          streamFlushHandle = requestAnimationFrame(flushStreamBuffer);
        }
      }
      if (data.cancelled || data.done || data.error) {
        closeStream();
      }
    } catch {
      // Ignore malformed stream data.
    }
  };

  currentStream.onerror = () => {
    closeStream();
    currentStreamText = null;
  };
}

function renderTasks(tasks) {
  if (!tasksEl) return;
  tasksEl.innerHTML = "...";

  if (!Array.isArray(tasks) || tasks.length === 0) {
    const empty = document.createElement("..."div"...");
    empty.className = "..."task"...";
    empty.textContent = "..."No daily tasks yet."...";
    tasksEl.appendChild(empty);
    return;
  }

  tasks.forEach((task, index) => {
    const item = document.createElement("..."div"...");
    item.className = "..."task"...";
    item.textContent = `${index + 1}. ${task}`;
    tasksEl.appendChild(item);
  });
}

async function fetchTasks() {
  if (!tasksEl) return;
  try {
    const res = await fetch(`${API_BASE}/tasks?userId=default`, {
      headers: {
        "..."Authorization"...": `Bearer ${API_KEY}`
      }
    });
    if (!res.ok) return;
    const data = await res.json();
    renderTasks(data?.tasks ?? []);
  } catch {
    // Ignore task fetch errors.
  }
}

function renderPersonal(items) {
  if (!personalEl) return;
  personalEl.innerHTML = "...";

  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("..."div"...");
    empty.className = "..."item"...";
    empty.textContent = "..."No personal data yet."...";
    personalEl.appendChild(empty);
    return;
  }

  items.forEach(({ key, value }) => {
    const item = document.createElement("..."div"...");
    item.className = "..."item"...";
    item.textContent = `${key}: ${value}`;
    personalEl.appendChild(item);
  });
}

async function fetchPersonal() {
  if (!personalEl) return;
  try {
    const res = await fetch(`${API_BASE}/personal?userId=default`, {
      headers: {
        "..."Authorization"...": `Bearer ${API_KEY}`
      }
    });
    if (!res.ok) return;
    const data = await res.json();
    renderPersonal(data?.items ?? []);
  } catch {
    // Ignore personal fetch errors.
  }
}

function setStatus(dot, label, isOnline, text) {
  if (!dot || !label) return;
  dot.classList.toggle("..."online"...", isOnline);
  dot.classList.toggle("..."offline"...", !isOnline);
  dot.classList.remove("..."busy"...");
  label.textContent = text;
}

function setWorkerStatus(state) {
  if (!workerDot || !workerStatus) return;
  workerDot.classList.remove("..."online"...", "..."offline"...", "..."busy"...");
  if (state === "..."busy"...") {
    workerDot.classList.add("..."busy"...");
    workerStatus.textContent = "..."busy"...";
    return;
  }
  if (state === "..."online"...") {
    workerDot.classList.add("..."online"...");
    workerStatus.textContent = "..."online"...";
    return;
  }
  workerDot.classList.add("..."offline"...");
  workerStatus.textContent = "..."offline"...";
}

async function fetchStatus() {
  setStatus(webDot, webStatus, true, "..."online"...");
  try {
    const res = await fetch(`${API_BASE}/status?userId=default`, {
      headers: {
        "..."Authorization"...": `Bearer ${API_KEY}`
      }
    });
    if (!res.ok) {
      setStatus(relayDot, relayStatus, false, "..."offline"...");
      setWorkerStatus("..."offline"...");
      return;
    }
    const data = await res.json();
    setStatus(relayDot, relayStatus, true, "..."online"...");

    const lastSeen = data?.workerLastSeen ? Date.parse(data.workerLastSeen) : NaN;
    const ageMs = Number.isNaN(lastSeen) ? Infinity : Date.now() - lastSeen;
    const workerOnline = ageMs < 15000;
    if (!workerOnline) {
      setWorkerStatus("..."offline"...");
      return;
    }
    const workerState = data?.workerStatus === "..."busy"..." ? "..."busy"..." : "..."online"...";
    setWorkerStatus(workerState);
  } catch {
    setStatus(relayDot, relayStatus, false, "..."offline"...");
    setWorkerStatus("..."offline"...");
  }
}

function updateClock() {
  if (!statusTime) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "..."0"...");
  const mm = String(now.getMinutes()).padStart(2, "..."0"...");
  const ss = String(now.getSeconds()).padStart(2, "..."0"...");
  statusTime.textContent = `${hh}:${mm}:${ss}`;
}

function titleCase(text) {
  if (!text) return "...";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

async function fetchWeatherStatus() {
  if (!statusWeather) return;
  try {
    const res = await fetch(`${API_BASE}/weather?userId=default`, {
      headers: {
        "..."Authorization"...": `Bearer ${API_KEY}`
      }
    });
    if (!res.ok) return;
    const data = await res.json();
    const summary = data?.summary ?? {};
    const temp = summary.currentTempF;
    const condition = titleCase(summary.currentCondition ?? "...");
    if (Number.isFinite(Number(temp))) {
      statusWeather.textContent = `Weather: ${Math.round(Number(temp))}F ${condition}`;
    } else {
      statusWeather.textContent = "..."Weather: --"...";
    }
  } catch {
    statusWeather.textContent = "..."Weather: --"...";
  }
}

// Fallback for environments where key events fire but the input value doesn't update.
function ensureInputUpdates() {
  input.addEventListener("..."keydown"...", (event) => {
    if (event.isComposing || event.key === "..."Process"...") return;

    const printable =
      event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    const isBackspace = event.key === "..."Backspace"...";
    const isDelete = event.key === "..."Delete"...";

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
  input.value = "...";
  autoResizeInput();

  addMessage(text, "..."user"...");
  status.textContent = "..."Sending…"...";
  cancelBtn.disabled = true;

  const res = await fetch(`${API_BASE}/jobs`, {
    method: "..."POST"...",
    headers: {
      "..."Authorization"...": `Bearer ${API_KEY}`,
      "..."Content-Type"...": "..."application/json"..."
    },
    body: JSON.stringify({
      userId: "..."default"...",
      message: text
    })
  });

  const { jobId } = await res.json();
  currentJobId = jobId;
  cancelBtn.disabled = false;
  startStream(jobId);
  pollJob(jobId);
  fetchTasks();
}

async function pollJob(jobId) {
  status.textContent = "..."Wayne is thinking…"...";

  if (currentPollTimer) clearInterval(currentPollTimer);
  currentPollTimer = setInterval(async () => {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: {
        "..."Authorization"...": `Bearer ${API_KEY}`
      }
    });
    const job = await res.json();

    if (job.status === "..."done"...") {
      clearInterval(currentPollTimer);
      currentPollTimer = null;
      if (currentStreamText) {
        if (!streamHasOutput && job.reply) {
          currentStreamText.textContent = job.reply;
        }
        currentStreamText = null;
      } else {
        addMessage(job.reply, "..."wayne"...");
      }
      status.textContent = "...";
      currentJobId = null;
      cancelBtn.disabled = true;
      return;
    }
    if (job.status === "..."cancelled"...") {
      clearInterval(currentPollTimer);
      currentPollTimer = null;
      status.textContent = "..."Cancelled."...";
      if (statusClearTimer) clearTimeout(statusClearTimer);
      statusClearTimer = setTimeout(() => {
        status.textContent = "...";
      }, 3000);
      currentJobId = null;
      cancelBtn.disabled = true;
      closeStream();
      currentStreamText = null;
    }
  }, 250);
}

async function cancelMessage() {
  if (!currentJobId) return;
  cancelBtn.disabled = true;
  status.textContent = "..."Cancelling…"...";

  try {
    await fetch(`${API_BASE}/jobs/${currentJobId}/cancel`, {
      method: "..."POST"...",
      headers: {
        "..."Authorization"...": `Bearer ${API_KEY}`
      }
    });
  } catch {
    // Ignore cancel errors; fall back to status poll.
  }

  if (currentPollTimer) {
    clearInterval(currentPollTimer);
    currentPollTimer = null;
  }
  status.textContent = "..."Cancelled."...";
  if (statusClearTimer) clearTimeout(statusClearTimer);
  statusClearTimer = setTimeout(() => {
    status.textContent = "...";
  }, 3000);
  currentJobId = null;
  closeStream();
  currentStreamText = null;
}

sendBtn.onclick = sendMessage;
cancelBtn.onclick = cancelMessage;
input.onkeydown = (event) => {
  if (event.key === "..."Enter"..." && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};
input.addEventListener("..."input"...", autoResizeInput);
ensureInputUpdates();
autoResizeInput();
renderTasks([]);
fetchTasks();
setInterval(fetchTasks, 2000);
renderPersonal([]);
fetchPersonal();
setInterval(fetchPersonal, 2000);
fetchStatus();
setInterval(fetchStatus, 2000);
updateClock();
setInterval(updateClock, 1000);
fetchWeatherStatus();
setInterval(fetchWeatherStatus, 30 * 60 * 1000);


