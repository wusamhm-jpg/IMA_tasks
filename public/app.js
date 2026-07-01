// app.js — منطق واجهة تطبيق ima لإدارة المهام
const API = '/api';

let state = {
  tasks: [],
  categories: [],
  currentFilter: 'all',
  currentCategoryId: null,
  searchTerm: '',
};

// ---------- أدوات مساعدة ----------

function $(id) { return document.getElementById(id); }

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

function priorityLabel(p) {
  return { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' }[p] || p;
}

function statusLabel(s) {
  return { pending: 'قيد الانتظار', in_progress: 'قيد التنفيذ', done: 'مكتملة' }[s] || s;
}

function showToast(message, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  $('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ---------- استدعاءات API ----------

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error('فشل الطلب');
  return res.json();
}

async function apiSend(path, method, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل الطلب');
  }
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('فشل الحذف');
  return res.json();
}

// ---------- تحميل البيانات ----------

async function loadCategories() {
  state.categories = await apiGet('/categories');
  renderCategories();
  populateCategorySelect();
}

async function loadTasks() {
  state.tasks = await apiGet('/tasks');
  renderTasks();
  await loadStats();
  checkAlerts();
}

async function loadStats() {
  const stats = await apiGet('/tasks/stats');
  $('statTotal').textContent = stats.total;
  $('statDone').textContent = stats.done;
  $('statPending').textContent = stats.pending;
  $('statOverdue').textContent = stats.overdue;

  $('count-all').textContent = stats.total;
  $('count-pending').textContent = stats.pending;
  $('count-done').textContent = stats.done;
  $('count-overdue').textContent = stats.overdue;
  $('count-inprogress').textContent = state.tasks.filter(t => t.status === 'in_progress').length;
}

// ---------- العرض ----------

function renderCategories() {
  const list = $('categoryList');
  list.innerHTML = '';
  state.categories.forEach(cat => {
    const li = document.createElement('li');
    li.className = state.currentCategoryId === cat.id ? 'active' : '';
    li.innerHTML = `<span class="dot" style="background:${cat.color}"></span><span>${escapeHtml(cat.name)}</span>`;
    li.addEventListener('click', () => {
      state.currentCategoryId = state.currentCategoryId === cat.id ? null : cat.id;
      renderCategories();
      renderTasks();
    });
    list.appendChild(li);
  });
}

function populateCategorySelect() {
  const select = $('taskCategory');
  select.innerHTML = '<option value="">بدون تصنيف</option>';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getFilteredTasks() {
  let tasks = [...state.tasks];

  if (state.currentFilter === 'overdue') {
    tasks = tasks.filter(t => t.status !== 'done' && t.due_date && daysUntil(t.due_date) < 0);
  } else if (state.currentFilter !== 'all') {
    tasks = tasks.filter(t => t.status === state.currentFilter);
  }

  if (state.currentCategoryId) {
    tasks = tasks.filter(t => t.category_id === state.currentCategoryId);
  }

  if (state.searchTerm) {
    const term = state.searchTerm.toLowerCase();
    tasks = tasks.filter(t =>
      t.title.toLowerCase().includes(term) ||
      (t.description || '').toLowerCase().includes(term)
    );
  }

  return tasks;
}

function renderTasks() {
  const list = $('tasksList');
  const tasks = getFilteredTasks();
  list.innerHTML = '';

  $('emptyState').hidden = tasks.length > 0;

  tasks.forEach(task => {
    const card = document.createElement('div');
    card.className = `task-card ${task.status === 'done' ? 'done' : ''}`;

    const diff = task.due_date ? daysUntil(task.due_date) : null;
    let dueClass = '';
    let dueLabel = '';
    if (diff !== null && task.status !== 'done') {
      if (diff < 0) { dueClass = 'overdue'; dueLabel = `متأخرة ${Math.abs(diff)} يوم`; }
      else if (diff === 0) { dueClass = 'soon'; dueLabel = 'اليوم'; }
      else if (diff <= 2) { dueClass = 'soon'; dueLabel = `خلال ${diff} يوم`; }
      else { dueLabel = formatDate(task.due_date); }
    } else if (task.due_date) {
      dueLabel = formatDate(task.due_date);
    }

    card.innerHTML = `
      <div class="task-check ${task.status === 'done' ? 'checked' : ''}">${task.status === 'done' ? '✓' : ''}</div>
      <div class="task-body">
        <p class="task-title">${escapeHtml(task.title)}</p>
        <div class="task-meta">
          ${task.category_name ? `<span class="badge badge-cat"><span class="dot" style="background:${task.category_color}"></span>${escapeHtml(task.category_name)}</span>` : ''}
          <span class="badge badge-priority-${task.priority}">${priorityLabel(task.priority)}</span>
          ${task.due_date ? `<span class="due-date ${dueClass}">📅 ${dueLabel}</span>` : ''}
        </div>
      </div>
      <span class="status-tag status-${task.status}">${statusLabel(task.status)}</span>
    `;

    card.querySelector('.task-check').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDone(task);
    });

    card.addEventListener('click', () => openTaskModal(task));
    list.appendChild(card);
  });
}

async function toggleDone(task) {
  const newStatus = task.status === 'done' ? 'pending' : 'done';
  await apiSend(`/tasks/${task.id}`, 'PUT', { status: newStatus });
  await loadTasks();
}

// ---------- التنبيهات (Alerts) ----------

let alertedTaskIds = new Set();

function checkAlerts() {
  state.tasks.forEach(task => {
    if (task.status === 'done' || !task.due_date) return;
    const diff = daysUntil(task.due_date);
    const key = `${task.id}-${diff < 0 ? 'overdue' : diff}`;
    if (alertedTaskIds.has(key)) return;

    if (diff < 0) {
      showToast(`⚠️ المهمة "${task.title}" متأخرة عن موعدها`, 'alert');
      alertedTaskIds.add(key);
    } else if (diff === 0) {
      showToast(`⏰ المهمة "${task.title}" مستحقة اليوم`, 'alert');
      alertedTaskIds.add(key);
    } else if (diff === 1) {
      showToast(`🔔 المهمة "${task.title}" مستحقة غداً`);
      alertedTaskIds.add(key);
    }
  });
}

// ---------- النوافذ المنبثقة (Modals) ----------

function openTaskModal(task = null) {
  $('taskForm').reset();
  $('deleteTaskBtn').hidden = true;

  if (task) {
    $('modalTitle').textContent = 'تعديل المهمة';
    $('taskId').value = task.id;
    $('taskTitle').value = task.title;
    $('taskDescription').value = task.description || '';
    $('taskCategory').value = task.category_id || '';
    $('taskPriority').value = task.priority;
    $('taskDueDate').value = task.due_date ? task.due_date.split('T')[0] : '';
    $('taskStatus').value = task.status;
    $('deleteTaskBtn').hidden = false;
  } else {
    $('modalTitle').textContent = 'مهمة جديدة';
    $('taskId').value = '';
  }

  $('taskModal').hidden = false;
}

function closeTaskModal() {
  $('taskModal').hidden = true;
}

async function handleTaskSubmit(e) {
  e.preventDefault();
  const id = $('taskId').value;
  const payload = {
    title: $('taskTitle').value.trim(),
    description: $('taskDescription').value.trim(),
    category_id: $('taskCategory').value || null,
    priority: $('taskPriority').value,
    due_date: $('taskDueDate').value || null,
    status: $('taskStatus').value,
  };

  try {
    if (id) {
      await apiSend(`/tasks/${id}`, 'PUT', payload);
      showToast('تم تحديث المهمة', 'success');
    } else {
      await apiSend('/tasks', 'POST', payload);
      showToast('تمت إضافة المهمة', 'success');
    }
    closeTaskModal();
    await loadTasks();
  } catch (err) {
    showToast(err.message, 'alert');
  }
}

async function handleDeleteTask() {
  const id = $('taskId').value;
  if (!id) return;
  if (!confirm('هل تريد حذف هذه المهمة؟')) return;
  await apiDelete(`/tasks/${id}`);
  closeTaskModal();
  showToast('تم حذف المهمة', 'success');
  await loadTasks();
}

async function handleCategorySubmit(e) {
  e.preventDefault();
  const name = $('categoryName').value.trim();
  const color = $('categoryColor').value;
  try {
    await apiSend('/categories', 'POST', { name, color });
    $('categoryModal').hidden = true;
    $('categoryForm').reset();
    await loadCategories();
    showToast('تمت إضافة التصنيف', 'success');
  } catch (err) {
    showToast(err.message, 'alert');
  }
}

// ---------- ربط الأحداث ----------

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  $('newTaskBtn').addEventListener('click', () => openTaskModal());
  $('closeModalBtn').addEventListener('click', closeTaskModal);
  $('taskModal').addEventListener('click', (e) => { if (e.target.id === 'taskModal') closeTaskModal(); });
  $('taskForm').addEventListener('submit', handleTaskSubmit);
  $('deleteTaskBtn').addEventListener('click', handleDeleteTask);

  $('addCategoryBtn').addEventListener('click', () => { $('categoryModal').hidden = false; });
  $('closeCategoryModalBtn').addEventListener('click', () => { $('categoryModal').hidden = true; });
  $('categoryModal').addEventListener('click', (e) => { if (e.target.id === 'categoryModal') $('categoryModal').hidden = true; });
  $('categoryForm').addEventListener('submit', handleCategorySubmit);

  $('searchInput').addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    renderTasks();
  });
}

// ---------- بدء التشغيل ----------

async function init() {
  bindEvents();
  await loadCategories();
  await loadTasks();
  // فحص دوري للتنبيهات كل 5 دقائق
  setInterval(checkAlerts, 5 * 60 * 1000);
}

init();
