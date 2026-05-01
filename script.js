const STORAGE_KEY = "codetrail-progress-v1";

const state = {
  completed: loadProgress(),
  query: "",
  day: "all",
  status: "all",
};

const elements = {
  roadmap: document.querySelector("#roadmap"),
  emptyState: document.querySelector("#emptyState"),
  searchInput: document.querySelector("#searchInput"),
  dayFilter: document.querySelector("#dayFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  saveButton: document.querySelector("#saveButton"),
  importButton: document.querySelector("#importButton"),
  importInput: document.querySelector("#importInput"),
  shareButton: document.querySelector("#shareButton"),
  toast: document.querySelector("#toast"),
  resetButton: document.querySelector("#resetButton"),
  resetModal: document.querySelector("#resetModal"),
  cancelResetButton: document.querySelector("#cancelResetButton"),
  confirmResetButton: document.querySelector("#confirmResetButton"),
  progressBar: document.querySelector("#progressBar"),
  progressLabel: document.querySelector("#progressLabel"),
  taskCount: document.querySelector("#taskCount"),
  completedCount: document.querySelector("#completedCount"),
  remainingCount: document.querySelector("#remainingCount"),
  streakHint: document.querySelector("#streakHint"),
  dayCount: document.querySelector("#dayCount"),
  weekCount: document.querySelector("#weekCount"),
  visibleCount: document.querySelector("#visibleCount"),
};

const tasks = ROADMAP.flatMap((day) =>
  day.questions.map((question, index) => ({
    ...question,
    id: `day-${day.day}-q-${index}`,
    day: day.day,
    dayTitle: day.title,
    week: day.week,
  })),
);
const taskById = new Map(tasks.map((task) => [task.id, task]));
let toastTimer;

function loadProgress() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.completed]));
}

function showToast(message, type = "success") {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.dataset.type = type;
  elements.toast.hidden = false;

  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2200);
}

function getProgressBackup() {
  return {
    app: "CodeTrail",
    version: 1,
    exportedAt: new Date().toISOString(),
    completed: [...state.completed],
  };
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportProgress() {
  downloadJson("progress-backup.json", getProgressBackup());
  showToast("Progress saved");
}

function normalizeImportedProgress(payload) {
  const importedIds = Array.isArray(payload) ? payload : payload?.completed;

  if (!Array.isArray(importedIds)) {
    throw new Error("Invalid progress backup.");
  }

  return importedIds.filter((id) => typeof id === "string" && taskById.has(id));
}

function applyProgressIds(progressIds) {
  state.completed = new Set(progressIds);
  saveProgress();
  updateProgress();
  syncRenderedCompletion();

  if (state.status !== "all") {
    renderRoadmap();
  }
}

function readImportFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(reader.result);
      const progressIds = normalizeImportedProgress(payload);

      if (!window.confirm("This will replace your current progress. Continue?")) {
        return;
      }

      applyProgressIds(progressIds);
      showToast("Progress imported");
    } catch {
      showToast("Invalid JSON file", "error");
    } finally {
      elements.importInput.value = "";
    }
  });

  reader.addEventListener("error", () => {
    showToast("Unable to read file", "error");
    elements.importInput.value = "";
  });

  reader.readAsText(file);
}

async function copyShareLink() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(window.location.href);
    } else {
      copyWithTemporaryInput();
    }

    showToast("Link copied");
  } catch {
    if (copyWithTemporaryInput()) {
      showToast("Link copied");
      return;
    }

    showToast("Could not copy link", "error");
  }
}

function copyWithTemporaryInput() {
  const input = document.createElement("input");
  input.value = window.location.href;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();

  const copied = document.execCommand("copy");
  input.remove();
  return copied;
}

function platformFromUrl(url) {
  if (!url) return "Practice";
  if (url.includes("leetcode.com")) return "LeetCode";
  if (url.includes("geeksforgeeks.org")) return "GFG";
  return "Link";
}

function externalIcon() {
  return `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  `;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

function isVisibleTask(task) {
  const haystack = `${task.title} ${task.note} ${task.dayTitle} ${task.week}`.toLowerCase();
  const matchesQuery = haystack.includes(state.query);
  const matchesDay = state.day === "all" || task.day === state.day;
  const done = state.completed.has(task.id);
  const matchesStatus =
    state.status === "all" || (state.status === "done" && done) || (state.status === "open" && !done);

  return matchesQuery && matchesDay && matchesStatus;
}

function updateProgress() {
  const total = tasks.length;
  const completed = tasks.filter((task) => state.completed.has(task.id)).length;
  const rawPercentage = total ? (completed / total) * 100 : 0;
  const percentage = Math.round(rawPercentage);
  const displayPercentage =
    completed > 0 && rawPercentage < 10 ? rawPercentage.toFixed(1) : String(percentage);
  const nextTask = tasks.find((task) => !state.completed.has(task.id));

  elements.progressBar.style.width = `${rawPercentage}%`;
  elements.progressLabel.textContent = `${displayPercentage}% complete`;
  elements.taskCount.textContent = `${completed} / ${total} solved`;
  elements.completedCount.textContent = completed;
  elements.remainingCount.textContent = total - completed;
  elements.streakHint.textContent = nextTask ? `Day ${nextTask.day}` : "Done";
}

function getDayTasks(dayValue) {
  return tasks.filter((task) => task.day === dayValue);
}

function updateDayProgress(dayValue) {
  const dayCard = elements.roadmap.querySelector(`[data-day="${CSS.escape(dayValue)}"]`);
  if (!dayCard) return;

  const dayTasks = getDayTasks(dayValue);
  const doneInDay = dayTasks.filter((task) => state.completed.has(task.id)).length;
  const percentage = dayTasks.length ? Math.round((doneInDay / dayTasks.length) * 100) : 0;

  dayCard.querySelector("[data-day-count]").textContent = `${doneInDay}/${dayTasks.length} done`;
  dayCard.querySelector("[data-day-progress]").style.width = `${percentage}%`;
}

function updateVisibleCount(delta) {
  const current = Number(elements.visibleCount.textContent) || 0;
  elements.visibleCount.textContent = Math.max(0, current + delta);
}

function removeQuestionFromFilteredView(questionElement) {
  const dayCard = questionElement.closest(".day-card");
  questionElement.classList.add("leaving");
  updateVisibleCount(-1);

  window.setTimeout(() => {
    questionElement.remove();

    if (dayCard && !dayCard.querySelector(".question")) {
      dayCard.remove();
    }

    elements.emptyState.hidden = elements.roadmap.querySelectorAll(".question").length !== 0;
  }, 180);
}

function toggleTask(checkbox) {
  const taskId = checkbox.dataset.taskId;
  const task = taskById.get(taskId);
  const questionElement = checkbox.closest(".question");
  if (!task || !questionElement) return;

  if (checkbox.checked) {
    state.completed.add(taskId);
    questionElement.classList.add("done", "just-completed");
  } else {
    state.completed.delete(taskId);
    questionElement.classList.remove("done");
    questionElement.classList.add("just-updated");
  }

  window.setTimeout(() => {
    questionElement.classList.remove("just-completed", "just-updated");
  }, 320);

  saveProgress();
  updateProgress();
  updateDayProgress(task.day);

  if (
    (state.status === "open" && checkbox.checked) ||
    (state.status === "done" && !checkbox.checked)
  ) {
    removeQuestionFromFilteredView(questionElement);
  }
}

function resetVisibleCompletionStates() {
  elements.roadmap.querySelectorAll(".question").forEach((questionElement) => {
    questionElement.classList.remove("done", "just-completed", "just-updated");
    const checkbox = questionElement.querySelector("input[type='checkbox']");
    checkbox.checked = false;
  });

  ROADMAP.forEach((day) => updateDayProgress(day.day));
}

function syncRenderedCompletion() {
  elements.roadmap.querySelectorAll(".question").forEach((questionElement) => {
    const taskId = questionElement.dataset.taskId;
    const checkbox = questionElement.querySelector("input[type='checkbox']");
    const isDone = state.completed.has(taskId);

    checkbox.checked = isDone;
    questionElement.classList.toggle("done", isDone);
    questionElement.classList.remove("just-completed", "just-updated", "leaving");
  });

  ROADMAP.forEach((day) => updateDayProgress(day.day));
}

function renderDayOptions() {
  ROADMAP.forEach((day) => {
    const option = document.createElement("option");
    option.value = day.day;
    option.textContent = `Day ${day.day} - ${day.title}`;
    elements.dayFilter.append(option);
  });
}

function renderSummary(visibleTotal) {
  elements.dayCount.textContent = ROADMAP.length;
  elements.weekCount.textContent = new Set(ROADMAP.map((day) => day.week)).size;
  elements.visibleCount.textContent = visibleTotal;
}

function renderRoadmap() {
  const visibleByDay = ROADMAP.map((day) => {
    const questions = day.questions
      .map((question, index) => ({
        ...question,
        id: `day-${day.day}-q-${index}`,
        day: day.day,
        dayTitle: day.title,
        week: day.week,
      }))
      .filter(isVisibleTask);
    return { ...day, questions };
  }).filter((day) => day.questions.length > 0);

  const visibleTotal = visibleByDay.reduce((sum, day) => sum + day.questions.length, 0);
  renderSummary(visibleTotal);
  elements.emptyState.hidden = visibleTotal !== 0;

  elements.roadmap.innerHTML = visibleByDay.map((day, dayIndex) => {
    const allDayTasks = tasks.filter((task) => task.day === day.day);
    const doneInDay = allDayTasks.filter((task) => state.completed.has(task.id)).length;
    const dayPercentage = allDayTasks.length ? Math.round((doneInDay / allDayTasks.length) * 100) : 0;

    return `
      <article class="day-card" data-day="${escapeHtml(day.day)}" style="animation-delay: ${Math.min(dayIndex * 24, 240)}ms">
        <header class="day-header">
          <div class="day-pill">D${escapeHtml(day.day)}</div>
          <div class="day-title">
            <h2>${escapeHtml(day.title)}</h2>
            <p>${escapeHtml(day.week)}</p>
          </div>
          <div class="day-progress">
            <span data-day-count>${doneInDay}/${allDayTasks.length} done</span>
            <div class="mini-progress" aria-hidden="true"><span data-day-progress style="width: ${dayPercentage}%"></span></div>
          </div>
        </header>
        <div class="question-list">
          ${day.questions.map(renderQuestion).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function renderQuestion(question) {
  const checked = state.completed.has(question.id);
  const title = escapeHtml(question.title);
  const note = question.note ? `<span class="note">${escapeHtml(question.note)}</span>` : "";
  const linkButton = question.url
    ? `<button class="platform link-button" type="button" data-url="${escapeHtml(question.url)}">${platformFromUrl(question.url)}${externalIcon()}</button>`
    : `<span class="platform">Practice</span>`;

  return `
    <div class="question ${checked ? "done" : ""}" data-task-id="${question.id}">
      <input type="checkbox" data-task-id="${question.id}" ${checked ? "checked" : ""} />
      <span class="question-title"><span>${title}</span>${note}</span>
      ${linkButton}
    </div>
  `;
}

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  renderRoadmap();
});

elements.dayFilter.addEventListener("change", (event) => {
  state.day = event.target.value;
  renderRoadmap();
});

elements.statusFilter.addEventListener("change", (event) => {
  state.status = event.target.value;
  renderRoadmap();
});

elements.saveButton.addEventListener("click", exportProgress);

elements.importButton.addEventListener("click", () => {
  elements.importInput.click();
});

elements.importInput.addEventListener("change", (event) => {
  readImportFile(event.target.files[0]);
});

elements.shareButton.addEventListener("click", copyShareLink);

elements.roadmap.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input[type='checkbox']");
  if (!checkbox) return;

  toggleTask(checkbox);
});

elements.roadmap.addEventListener("click", (event) => {
  const linkButton = event.target.closest(".link-button");
  if (!linkButton) return;

  event.preventDefault();
  event.stopPropagation();
  window.open(linkButton.dataset.url, "_blank");
});

elements.resetButton.addEventListener("click", () => {
  elements.resetModal.hidden = false;
  elements.confirmResetButton.focus();
});

elements.cancelResetButton.addEventListener("click", () => {
  elements.resetModal.hidden = true;
});

elements.resetModal.addEventListener("click", (event) => {
  if (event.target === elements.resetModal) {
    elements.resetModal.hidden = true;
  }
});

elements.confirmResetButton.addEventListener("click", () => {
  elements.confirmResetButton.disabled = true;

  window.setTimeout(() => {
    state.completed.clear();
    saveProgress();
    updateProgress();
    resetVisibleCompletionStates();

    if (state.status !== "all") {
      renderRoadmap();
    }

    elements.confirmResetButton.disabled = false;
    elements.resetModal.hidden = true;
  }, 300);
});

renderDayOptions();
updateProgress();
renderRoadmap();
