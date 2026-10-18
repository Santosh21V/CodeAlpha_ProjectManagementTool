 const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'database.json');

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], projects: [], tasks: [], comments: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// 1. AUTHENTICATION SYSTEM (Register & Login)
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Username already exists! Please choose another one.' });
  }
  const newUser = { id: Date.now().toString(), username, password };
  db.users.push(newUser);
  writeDB(db);
  res.json({ id: newUser.id, username: newUser.username });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password!' });
  }
  res.json({ id: user.id, username: user.username });
});

// FETCH ALL DATA (Users, Projects, Tasks, Comments)
app.get('/api/data', (req, res) => {
  const db = readDB();
  res.json({
    users: db.users.map(u => ({ id: u.id, username: u.username })),
    projects: db.projects,
    tasks: db.tasks,
    comments: db.comments
  });
});

// 2. GROUP PROJECTS (Create Project & Add Group Members)
app.post('/api/projects', (req, res) => {
  const { name, createdBy } = req.body;
  const db = readDB();
  const newProject = {
    id: Date.now().toString(),
    name,
    createdBy,
    members: [createdBy]
  };
  db.projects.push(newProject);
  writeDB(db);

  io.emit('updateData', {
    message: `New group project "${name}" was created by ${createdBy}`,
    projectId: newProject.id
  });
  res.json(newProject);
});

app.post('/api/projects/:id/members', (req, res) => {
  const { username } = req.body;
  const db = readDB();
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found!' });

  if (!project.members) project.members = [project.createdBy];
  if (!project.members.includes(username)) {
    project.members.push(username);
    writeDB(db);
    io.emit('updateData', {
      message: `${username} was added to group project "${project.name}"`
    });
  }
  res.json(project);
});

// 3. TASK CARDS & ASSIGNMENT (Create, Update Status/Assignee, Delete)
app.post('/api/tasks', (req, res) => {
  const { projectId, title, description, priority, dueDate, assignedTo, createdBy } = req.body;
  const db = readDB();
  const newTask = {
    id: Date.now().toString(),
    projectId,
    title,
    description: description || '',
    priority: priority || 'Medium',
    dueDate: dueDate || '',
    assignedTo: assignedTo || 'Unassigned',
    createdBy: createdBy || 'User',
    status: 'To Do'
  };
  db.tasks.push(newTask);
  writeDB(db);

  io.emit('updateData', {
    message: `New task "${title}" assigned to ${newTask.assignedTo}`
  });
  res.json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
  const { status, assignedTo } = req.body;
  const db = readDB();
  const task = db.tasks.find(t => t.id === req.params.id);
  if (task) {
    if (status) task.status = status;
    if (assignedTo) task.assignedTo = assignedTo;
    writeDB(db);
    io.emit('updateData', {
      message: `Task "${task.title}" updated (Status: ${task.status}, Assignee: ${task.assignedTo})`
    });
  }
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const db = readDB();
  const taskIndex = db.tasks.findIndex(t => t.id === req.params.id);
  if (taskIndex !== -1) {
    const removedTask = db.tasks.splice(taskIndex, 1)[0];
    db.comments = db.comments.filter(c => c.taskId !== req.params.id);
    writeDB(db);
    io.emit('updateData', {
      message: `Task "${removedTask.title}" was deleted`
    });
  }
  res.json({ success: true });
});

// 4. IN-TASK COMMENTS & COMMUNICATION
app.post('/api/comments', (req, res) => {
  const { taskId, author, text } = req.body;
  const db = readDB();
  const task = db.tasks.find(t => t.id === taskId);
  const newComment = {
    id: Date.now().toString(),
    taskId,
    author,
    text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  db.comments.push(newComment);
  writeDB(db);

  io.emit('updateData', {
    message: `${author} commented on "${task ? task.title : 'a task'}": "${text}"`
  });
  res.json(newComment);
});

// 5. WEBSOCKETS FOR REAL-TIME UPDATES
io.on('connection', (socket) => {
  console.log('User connected via WebSockets for real-time updates');
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on: http://localhost:${PORT}`);
});