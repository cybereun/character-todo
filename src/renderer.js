const widget = document.querySelector('.widget');
const characterButton = document.querySelector('.character-button');
const todoForm = document.querySelector('.todo-form');
const todoInput = document.querySelector('.todo-input');
const dueInput = document.querySelector('.due-input');
const dueButton = document.querySelector('.due-button');
const todoList = document.querySelector('.todo-list');
const viewToggle = document.querySelector('.view-toggle');
const todoCount = document.querySelector('.todo-count');
const undoToast = document.querySelector('.undo-toast');
const undoMessage = document.querySelector('.undo-message');
const undoButton = document.querySelector('.undo-button');
const burstLayer = document.querySelector('.burst-layer');

const storageKey = 'character-todo-items';
const particleColors = ['#ff7f9c', '#ffd76b', '#5bbf8d', '#63a7d6', '#b28cff'];
const panelAnimationMs = 420;
const doneHoldMs = 500;
const removeAnimationMs = 620;
const undoWindowMs = 4500;
const localStorageMigrationKey = `${storageKey}:migrated-to-file`;
const minimumValidDueAt = new Date('2020-01-01T00:00:00').getTime();

let todos = [];
let expanded = false;
let showingCompleted = false;
let editingId = null;
let dragState = null;
let audioContext = null;
let undoTodoId = null;
let undoToastTimer = null;

const pendingCompletions = new Map();

function normalizeDueAt(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' || /^[0-9]+$/.test(String(value))) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp >= minimumValidDueAt ? timestamp : null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp >= minimumValidDueAt ? timestamp : null;
}

function normalizeTodo(todo) {
  return {
    id: todo.id || createId(),
    text: typeof todo.text === 'string' ? todo.text : '',
    status: todo.status === 'completed' ? 'completed' : 'active',
    dueAt: normalizeDueAt(todo.dueAt),
    completedAt: todo.completedAt || null
  };
}

function loadLocalStorageTodos() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeTodo).filter((todo) => todo.text) : [];
  } catch {
    return [];
  }
}

async function loadTodos() {
  const localTodos = loadLocalStorageTodos();

  if (!window.characterTodo?.loadTodos) return localTodos;

  try {
    const fileTodos = await window.characterTodo.loadTodos();
    const normalizedFileTodos = Array.isArray(fileTodos)
      ? fileTodos.map(normalizeTodo).filter((todo) => todo.text)
      : [];

    if (normalizedFileTodos.length > 0) return normalizedFileTodos;

    const alreadyMigrated = localStorage.getItem(localStorageMigrationKey) === 'true';
    if (localTodos.length > 0 && !alreadyMigrated) {
      await window.characterTodo.saveTodos(localTodos);
      localStorage.setItem(localStorageMigrationKey, 'true');
      return localTodos;
    }

    return normalizedFileTodos;
  } catch {
    return localTodos;
  }
}

function saveTodos() {
  const normalizedTodos = todos.map(normalizeTodo).filter((todo) => todo.text);
  todos = normalizedTodos;
  localStorage.setItem(storageKey, JSON.stringify(todos));
  localStorage.setItem(localStorageMigrationKey, 'true');
  if (window.characterTodo?.saveTodos) {
    void window.characterTodo.saveTodos(todos);
  }
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function initTodos() {
  todos = await loadTodos();
  renderTodos();
  updateDueButton();
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function setExpanded(nextExpanded) {
  if (expanded === nextExpanded) return;

  expanded = nextExpanded;
  characterButton.setAttribute('aria-label', expanded ? '할일창 닫기' : '할일창 열기');
  widget.classList.add('is-window-changing');

  if (expanded) {
    await window.characterTodo.setExpanded(true);
    requestAnimationFrame(() => {
      widget.dataset.expanded = 'true';
      window.setTimeout(() => {
        widget.classList.remove('is-window-changing');
        todoInput.focus();
      }, panelAnimationMs);
    });
    return;
  }

  widget.dataset.expanded = 'false';
  window.setTimeout(async () => {
    await window.characterTodo.setExpanded(false);
    window.setTimeout(() => {
      widget.classList.remove('is-window-changing');
    }, 120);
  }, 280);
}

function getActiveTodos() {
  return todos.filter((todo) => todo.status !== 'completed');
}

function getCompletedTodos() {
  return todos.filter((todo) => todo.status === 'completed');
}

function isOverdue(todo) {
  return todo.status !== 'completed' && Number.isFinite(todo.dueAt) && todo.dueAt <= Date.now();
}

function getVisibleTodos() {
  if (showingCompleted) {
    return getCompletedTodos().filter((todo) => !pendingCompletions.has(todo.id));
  }

  return todos.filter((todo) => todo.status !== 'completed' || pendingCompletions.has(todo.id));
}

function renderTodos() {
  const activeCount = getActiveTodos().length;
  const completedCount = getCompletedTodos().length;
  const overdueCount = getActiveTodos().filter(isOverdue).length;
  widget.dataset.hasTodos = String(activeCount > 0);
  widget.dataset.hasOverdue = String(overdueCount > 0);
  viewToggle.textContent = showingCompleted ? '할일 목록 보기' : '완료한 일 보기';
  viewToggle.setAttribute('aria-pressed', String(showingCompleted));
  todoCount.textContent = showingCompleted
    ? `완료 ${completedCount}개`
    : overdueCount > 0
      ? `남은 일 ${activeCount}개 · 지남 ${overdueCount}개`
      : `남은 일 ${activeCount}개`;

  todoList.innerHTML = getVisibleTodos()
    .map((todo) => {
      const text = escapeHtml(todo.text);
      const pending = pendingCompletions.has(todo.id);
      const overdue = isOverdue(todo);
      const dueLabel = formatDueLabel(todo);

      if (!showingCompleted && todo.id === editingId) {
        return `
          <li class="todo-item is-editing" data-id="${todo.id}">
            <span class="edit-fields">
              <input class="edit-input" value="${text}" maxlength="80" aria-label="할일 수정" />
              <input class="edit-due-input" type="datetime-local" value="${formatDateTimeLocal(todo.dueAt)}" aria-label="마감 날짜와 시간 수정" />
            </span>
            <button class="icon-button save-button" type="button" data-action="save" title="저장" aria-label="저장">✓</button>
            <button class="icon-button" type="button" data-action="cancel" title="취소" aria-label="취소">↩</button>
          </li>
        `;
      }

      if (showingCompleted) {
        return `
          <li class="todo-item is-completed" data-id="${todo.id}">
            <span class="todo-text" title="${text}">${text}</span>
            <span class="completed-time">${formatCompletedTime(todo.completedAt)}</span>
            <button class="icon-button delete-button" type="button" data-action="delete" title="삭제" aria-label="삭제">×</button>
          </li>
        `;
      }

      return `
        <li class="todo-item${pending ? ' is-done-pending' : ''}${overdue ? ' is-overdue' : ''}" data-id="${todo.id}">
          <button class="icon-button done-button" type="button" data-action="complete" title="완료" aria-label="완료">✓</button>
          <span class="todo-main">
            <span class="todo-text" title="${text}">${text}</span>
            ${dueLabel ? `<span class="due-label">${dueLabel}</span>` : ''}
          </span>
          <button class="icon-button" type="button" data-action="edit" title="수정" aria-label="수정">✎</button>
          <button class="icon-button delete-button" type="button" data-action="delete" title="삭제" aria-label="삭제">×</button>
        </li>
      `;
    })
    .join('');

  const editInput = todoList.querySelector('.edit-input');
  if (editInput) {
    editInput.focus();
    editInput.select();
  }
}

function formatDueLabel(todo) {
  if (!Number.isFinite(todo.dueAt)) return '';

  const label = new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(todo.dueAt));

  return isOverdue(todo) ? `마감 지남 · ${label}` : `마감 ${label}`;
}

function formatCompletedTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const dueAt = parseDueInput(dueInput.value);

  todos.unshift({
    id: createId(),
    text: trimmed,
    status: 'active',
    dueAt,
    completedAt: null
  });
  saveTodos();
  renderTodos();
  todoInput.value = '';
  dueInput.value = '';
  updateDueButton();
}

function parseDueInput(value) {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  const timestamp = match
    ? new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5])
      ).getTime()
    : new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}

function updateTodo(id, text, dueValue) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const dueAt = parseDueInput(dueValue);

  todos = todos.map((todo) => (todo.id === id ? { ...todo, text: trimmed, dueAt } : todo));
  editingId = null;
  saveTodos();
  renderTodos();
}

function deleteTodo(id) {
  clearPendingCompletion(id);
  todos = todos.filter((todo) => todo.id !== id);
  if (undoTodoId === id) hideUndoToast();
  saveTodos();
  renderTodos();
}

function completeTodo(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo || todo.status === 'completed' || pendingCompletions.has(id)) return;

  todos = todos.map((item) =>
    item.id === id
      ? { ...item, status: 'completed', completedAt: Date.now() }
      : item
  );

  const completion = {
    effectTimer: null,
    removeTimer: null
  };
  pendingCompletions.set(id, completion);
  saveTodos();
  renderTodos();
  showUndoToast(id, todo.text);

  completion.effectTimer = window.setTimeout(() => {
    const item = todoList.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!item) {
      pendingCompletions.delete(id);
      renderTodos();
      return;
    }

    playDoneSound();
    makeBurst();
    widget.classList.add('is-celebrating');
    item.classList.add('is-completing');

    completion.removeTimer = window.setTimeout(() => {
      pendingCompletions.delete(id);
      widget.classList.remove('is-celebrating');
      renderTodos();
    }, removeAnimationMs);
  }, doneHoldMs);
}

function clearPendingCompletion(id) {
  const completion = pendingCompletions.get(id);
  if (!completion) return;

  window.clearTimeout(completion.effectTimer);
  window.clearTimeout(completion.removeTimer);
  pendingCompletions.delete(id);
  widget.classList.remove('is-celebrating');
}

function undoCompletion(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo || todo.status !== 'completed') return;

  clearPendingCompletion(id);
  todos = todos.map((item) =>
    item.id === id
      ? { ...item, status: 'active', completedAt: null }
      : item
  );
  showingCompleted = false;
  saveTodos();
  hideUndoToast();
  renderTodos();
}

function showUndoToast(id, text) {
  undoTodoId = id;
  undoMessage.textContent = `"${text}" 완료됨`;
  undoToast.classList.add('is-visible');
  window.clearTimeout(undoToastTimer);
  undoToastTimer = window.setTimeout(() => {
    if (undoTodoId === id) hideUndoToast();
  }, undoWindowMs);
}

function hideUndoToast() {
  undoTodoId = null;
  window.clearTimeout(undoToastTimer);
  undoToastTimer = null;
  undoToast.classList.remove('is-visible');
}

function playDoneSound() {
  audioContext = audioContext || new AudioContext();
  const now = audioContext.currentTime;
  const notes = [523.25, 659.25, 783.99];

  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now + index * 0.07);
    gain.gain.setValueAtTime(0.0001, now + index * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.07 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.07 + 0.18);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + index * 0.07);
    oscillator.stop(now + index * 0.07 + 0.2);
  });
}

function makeBurst() {
  burstLayer.replaceChildren();

  for (let i = 0; i < 18; i += 1) {
    const particle = document.createElement('span');
    const angle = (Math.PI * 2 * i) / 18;
    const distance = 54 + Math.random() * 54;
    particle.className = 'particle';
    particle.style.setProperty('--particle-x', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--particle-y', `${Math.sin(angle) * distance}px`);
    particle.style.setProperty('--particle-color', particleColors[i % particleColors.length]);
    particle.style.animationDelay = `${Math.random() * 70}ms`;
    burstLayer.append(particle);
  }

  window.setTimeout(() => burstLayer.replaceChildren(), 900);
}

function getTodoIdFromEvent(event) {
  return event.target.closest('.todo-item')?.dataset.id;
}

todoForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addTodo(todoInput.value);
});

dueButton.addEventListener('click', () => {
  if (typeof dueInput.showPicker === 'function') {
    dueInput.showPicker();
    return;
  }

  dueInput.focus();
  dueInput.click();
});

dueInput.addEventListener('change', updateDueButton);

function updateDueButton() {
  dueButton.classList.toggle('is-set', Boolean(dueInput.value));
  dueButton.title = dueInput.value ? `마감 ${formatInputDue(dueInput.value)}` : '마감 날짜와 시간';
}

function formatInputDue(value) {
  const timestamp = parseDueInput(value);
  if (!Number.isFinite(timestamp)) return '';

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

function formatDateTimeLocal(timestamp) {
  if (!Number.isFinite(timestamp)) return '';

  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

viewToggle.addEventListener('click', () => {
  showingCompleted = !showingCompleted;
  editingId = null;
  renderTodos();
});

undoButton.addEventListener('click', () => {
  if (undoTodoId) undoCompletion(undoTodoId);
});

todoList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = getTodoIdFromEvent(event);
  const action = button.dataset.action;
  const item = button.closest('.todo-item');

  if (action === 'complete') completeTodo(id);
  if (action === 'delete') deleteTodo(id);
  if (action === 'edit') {
    editingId = id;
    renderTodos();
  }
  if (action === 'save') {
    updateTodo(
      id,
      item.querySelector('.edit-input').value,
      item.querySelector('.edit-due-input').value
    );
  }
  if (action === 'cancel') {
    editingId = null;
    renderTodos();
  }
});

todoList.addEventListener('keydown', (event) => {
  if (!event.target.matches('.edit-input, .edit-due-input')) return;

  const id = getTodoIdFromEvent(event);
  const item = event.target.closest('.todo-item');
  if (event.key === 'Enter') {
    updateTodo(
      id,
      item.querySelector('.edit-input').value,
      item.querySelector('.edit-due-input').value
    );
  }
  if (event.key === 'Escape') {
    editingId = null;
    renderTodos();
  }
});

characterButton.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;

  characterButton.setPointerCapture(event.pointerId);
  dragState = {
    pointerId: event.pointerId,
    lastX: event.screenX,
    lastY: event.screenY,
    total: 0
  };
  event.preventDefault();
});

characterButton.addEventListener('pointermove', (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;

  const dx = event.screenX - dragState.lastX;
  const dy = event.screenY - dragState.lastY;
  if (dx === 0 && dy === 0) return;

  dragState.lastX = event.screenX;
  dragState.lastY = event.screenY;
  dragState.total += Math.abs(dx) + Math.abs(dy);
  window.characterTodo.moveBy(dx, dy);
});

characterButton.addEventListener('pointerup', (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;

  const wasDrag = dragState.total > 6;
  dragState = null;
  characterButton.releasePointerCapture(event.pointerId);

  if (!wasDrag) setExpanded(!expanded);
});

characterButton.addEventListener('pointercancel', () => {
  dragState = null;
});

void initTodos();
window.setInterval(() => {
  if (!editingId) renderTodos();
}, 15000);
