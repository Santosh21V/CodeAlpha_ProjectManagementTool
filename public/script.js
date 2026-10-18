 const socket = io();
let currentUser = null;
let appData = { users: [], projects: [], tasks: [], comments: [] };
let notifications = [];

// Real-Time WebSockets Listener
socket.on('updateData', (info) => {
  if (info && info.message) {
    showNotification(info.message);
    addNotificationToLog(info.message);
  }
  fetchData(info ? info.projectId : null);
});

function showNotification(msg) {
  const bar = document.getElementById('notification-bar');
  bar.innerText = `🔔 Live Update: ${msg}`;
  bar.classList.remove('hidden');
  setTimeout(() => bar.classList.add('hidden'), 4000);
}

function addNotificationToLog(msg) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  notifications.unshift({ msg, time });
  renderNotifications();
}

function renderNotifications() {
  document.getElementById('notif-count').innerText = notifications.length;
  const list = document.getElementById('notif-list');
  if (notifications.length === 0) {
    list.innerHTML = `<p class="empty-notif">No recent notifications.</p>`;
    return;
  }
  list.innerHTML = notifications.map(n => `
    <div class="notif-item">
      <div>${n.msg}</div>
      <small style="color:#888;">${n.time}</small>
    </div>
  `).join('');
}

function toggleNotifications() {
  document.getElementById('notif-dropdown').classList.toggle('hidden');
}

function clearNotifications() {
  notifications = [];
  renderNotifications();
}

// 1. AUTHENTICATION (Register & Login)
async function register() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!username || !password) return alert('Please enter both username and password!');

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (res.ok) {
    loginSuccess(data);
  } else {
    alert(data.error);
  }
}

async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!username || !password) return alert('Please enter both username and password!');

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (res.ok) {
    loginSuccess(data);
  } else {
    alert(data.error);
  }
}

function loginSuccess(user) {
  currentUser = user;
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');
  document.getElementById('welcome-user').innerText = `Logged in as: ${user.username}`;
  fetchData();
}

function logout() {
  currentUser = null;
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('app-section').classList.add('hidden');
}

// 2. FETCH ALL DATA FROM BACKEND
async function fetchData(newProjectId = null) {
  if (!currentUser) return;
  const res = await fetch('/api/data');
  appData = await res.json();
  updateDropdowns(newProjectId);
  renderBoard();
}

function updateDropdowns(newProjectId = null) {
  const projectSelect = document.getElementById('project-select');
  const previousProject = newProjectId || projectSelect.value;

  if (appData.projects.length === 0) {
    projectSelect.innerHTML = `<option value="">-- No Projects Yet --</option>`;
  } else {
    projectSelect.innerHTML = appData.projects.map(p =>
      `<option value="${p.id}">${p.name}</option>`
    ).join('');
    if (previousProject && appData.projects.some(p => p.id === previousProject)) {
      projectSelect.value = previousProject;
    }
  }

  // Populate User Dropdowns for Task Assignment & Adding Project Members
  const userOptions = appData.users.map(u => `<option value="${u.username}">${u.username}</option>`).join('');
  document.getElementById('assign-user-select').innerHTML =
    `<option value="Unassigned">Assign to User...</option>` + userOptions;
  document.getElementById('add-member-select').innerHTML =
    `<option value="">Add user to project...</option>` + userOptions;
}

// 3. CREATE GROUP PROJECT & ADD TEAM MEMBERS
async function createProject() {
  const nameInput = document.getElementById('new-project-name');
  const name = nameInput.value.trim();
  if (!name) return alert('Please enter a project name!');

  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, createdBy: currentUser.username })
  });
  const newProj = await res.json();
  nameInput.value = '';
  await fetchData(newProj.id);
}

async function addMemberToProject() {
  const projectId = document.getElementById('project-select').value;
  if (!projectId) return alert('Please create or select a project first!');

  const username = document.getElementById('add-member-select').value;
  if (!username) return alert('Please select a user to add to this project!');

  await fetch(`/api/projects/${projectId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
}

// 4. CREATE, UPDATE & DELETE TASK CARDS
async function createTask() {
  const projectId = document.getElementById('project-select').value;
  if (!projectId) return alert('Please create or select a project first!');

  const titleInput = document.getElementById('new-task-title');
  const descInput = document.getElementById('new-task-desc');
  const priority = document.getElementById('new-task-priority').value;
  const dueDate = document.getElementById('new-task-date').value;
  const assignedTo = document.getElementById('assign-user-select').value;

  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  if (!title) return alert('Please enter a task title!');

  await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      title,
      description,
      priority,
      dueDate,
      assignedTo,
      createdBy: currentUser.username
    })
  });

  titleInput.value = '';
  descInput.value = '';
  document.getElementById('new-task-date').value = '';
}

async function updateTaskStatus(taskId, newStatus) {
  await fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
}

async function reassignTask(taskId, newAssignee) {
  await fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignedTo: newAssignee })
  });
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task card?')) return;
  await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
}

// 5. ADD COMMENT INSIDE TASK CARD
async function addComment(taskId) {
  const input = document.getElementById(`comment-input-${taskId}`);
  const text = input.value.trim();
  if (!text) return alert('Please write a comment before sending!');

  await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, author: currentUser.username, text })
  });
  input.value = '';
}

// 6. RENDER PROJECT BOARD, TEAM MEMBERS & TASK CARDS
function renderBoard() {
  const projectId = document.getElementById('project-select').value;
  const todoCol = document.getElementById('col-todo');
  const progressCol = document.getElementById('col-progress');
  const doneCol = document.getElementById('col-done');
  const membersDisplay = document.getElementById('project-members-display');

  todoCol.innerHTML = '';
  progressCol.innerHTML = '';
  doneCol.innerHTML = '';
  membersDisplay.innerHTML = '';

  if (!projectId) {
    document.getElementById('count-todo').innerText = '0';
    document.getElementById('count-progress').innerText = '0';
    document.getElementById('count-done').innerText = '0';
    return;
  }

  // Display Group Project Members
  const currentProject = appData.projects.find(p => p.id === projectId);
  if (currentProject) {
    const members = currentProject.members || [currentProject.createdBy];
    membersDisplay.innerHTML = `<strong>👥 Team Members:</strong> ` +
      members.map(m => `<span class="member-pill">${m}</span>`).join('');
  }

  const projectTasks = appData.tasks.filter(t => t.projectId === projectId);
  let todoCount = 0, progressCount = 0, doneCount = 0;

  projectTasks.forEach(task => {
    const taskComments = appData.comments.filter(c => c.taskId === task.id);
    const priority = task.priority || 'Medium';

    const card = document.createElement('div');
    card.className = 'task-card';
    card.innerHTML = `
      <div class="card-top">
        <div class="task-title">${task.title}</div>
        <button class="delete-btn" onclick="deleteTask('${task.id}')" title="Delete Task">✖</button>
      </div>

      ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}

      <div class="badges-row">
        <span class="priority-badge priority-${priority}">Priority: ${priority}</span>
        ${task.dueDate ? `<span class="due-badge">📅 Due: ${task.dueDate}</span>` : ''}
      </div>

      <div class="task-meta">👤 Assigned to: <strong>${task.assignedTo}</strong></div>

      <div class="card-controls">
        <select class="status-select" onchange="updateTaskStatus('${task.id}', this.value)">
          <option value="To Do" ${task.status === 'To Do' ? 'selected' : ''}>Status: To Do</option>
          <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>Status: In Progress</option>
          <option value="Done" ${task.status === 'Done' ? 'selected' : ''}>Status: Done</option>
        </select>

        <select class="status-select" onchange="reassignTask('${task.id}', this.value)">
          <option value="Unassigned" ${task.assignedTo === 'Unassigned' ? 'selected' : ''}>Reassign...</option>
          ${appData.users.map(u => `
            <option value="${u.username}" ${task.assignedTo === u.username ? 'selected' : ''}>
              Assign: ${u.username}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="comments-section">
        <div style="font-size:12px; margin-bottom:4px;"><strong>💬 Comments (${taskComments.length}):</strong></div>
        <div class="comments-list">
          ${taskComments.map(c => `
            <div class="comment-item">
              <strong>${c.author}:</strong>${c.text}
              <span style="float:right;color:#888;">${c.time}</span>
            </div>
          `).join('')}
        </div>
        <div class="comment-box">
          <input type="text" id="comment-input-${task.id}" placeholder="Write a comment..." />
          <button onclick="addComment('${task.id}')">Send</button>
        </div>
      </div>
    `;

    if (task.status === 'To Do') {
      todoCol.appendChild(card);
      todoCount++;
    } else if (task.status === 'In Progress') {
      progressCol.appendChild(card);
      progressCount++;
    } else if (task.status === 'Done') {
      doneCol.appendChild(card);
      doneCount++;
    }
  });

  document.getElementById('count-todo').innerText = todoCount;
  document.getElementById('count-progress').innerText = progressCount;
  document.getElementById('count-done').innerText = doneCount;
}