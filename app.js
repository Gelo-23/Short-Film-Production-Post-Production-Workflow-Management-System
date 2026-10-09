var ALLOWED = [".mp4", ".mov", ".avi", ".mkv", ".wav", ".mp3", ".png", ".jpg", ".pdf", ".docx"];
var STAGES = ["Script", "Shot List", "Storyboard", "Footage Upload", "Editing", "Audio", "Color Grading", "Final Export"];
var ROLES = ["admin", "project_manager", "editor", "reviewer", "client"];

function seedData() {
  return {
    users: [
      {id: 1, username: "admin", password: "admin123", role: "admin"},
      {id: 2, username: "pm", password: "pm123", role: "project_manager"},
      {id: 3, username: "editor", password: "editor123", role: "editor"},
      {id: 4, username: "reviewer", password: "reviewer123", role: "reviewer"},
      {id: 5, username: "client", password: "client123", role: "client"}
    ],
    projects: [
      {id: 1, title: "Sample Short Film", description: "A 10 minute sample short film for the demo", status: "Ongoing", createdBy: "pm", createdAt: now()}
    ],
    tasks: [
      {id: 1, projectId: 1, title: "Draft storyboard", stage: "Storyboard", assignedTo: "editor", status: "For Review", dueDate: "2026-10-05"},
      {id: 2, projectId: 1, title: "Rough cut of scene 1", stage: "Editing", assignedTo: "editor", status: "Pending", dueDate: "2026-10-12"},
      {id: 3, projectId: 1, title: "Color grading", stage: "Color Grading", assignedTo: "editor", status: "Pending", dueDate: "2026-09-20"}
    ],
    assets: [
      {id: 1, taskId: 1, filename: "storyboard_v1.pdf", fileLink: "https://drive.google.com/sample-storyboard", version: 1, status: "For Review", notes: "first draft", uploadedBy: "editor", uploadedAt: now()}
    ],
    comments: [],
    notifications: [],
    auditLogs: [],
    integrationLogs: [],
    nextId: {user: 6, project: 2, task: 4, asset: 2, comment: 1, notification: 1, audit: 1, integration: 1}
  };
}

function loadData() {
  var raw = localStorage.getItem("filmflow_data");
  if (!raw) {
    var fresh = seedData();
    localStorage.setItem("filmflow_data", JSON.stringify(fresh));
    return fresh;
  }
  return JSON.parse(raw);
}

function saveData(data) {
  localStorage.setItem("filmflow_data", JSON.stringify(data));
}

function now() {
  var d = new Date();
  return d.toLocaleString();
}

function currentUser() {
  var raw = sessionStorage.getItem("filmflow_user");
  return raw ? JSON.parse(raw) : null;
}

function escapeHtml(text) {
  var div = document.createElement("div");
  div.innerText = text === undefined || text === null ? "" : String(text);
  return div.innerHTML;
}

function audit(action, details) {
  var data = loadData();
  var user = currentUser();
  data.auditLogs.unshift({
    id: data.nextId.audit++,
    username: user ? user.username : "system",
    action: action,
    details: details,
    createdAt: now()
  });
  saveData(data);
}

function notifyRole(role, message) {
  var data = loadData();
  data.users.filter(function (u) { return u.role === role; }).forEach(function (u) {
    data.notifications.unshift({
      id: data.nextId.notification++,
      userId: u.id,
      message: message,
      isRead: false,
      createdAt: now()
    });
  });
  saveData(data);
}

function notifyUser(username, message) {
  var data = loadData();
  var u = data.users.find(function (x) { return x.username === username; });
  if (u) {
    data.notifications.unshift({
      id: data.nextId.notification++,
      userId: u.id,
      message: message,
      isRead: false,
      createdAt: now()
    });
    saveData(data);
  }
}

function integrationLog(event, status, payload, error) {
  var data = loadData();
  data.integrationLogs.unshift({
    id: data.nextId.integration++,
    event: event,
    status: status,
    payload: JSON.stringify(payload),
    error: error || "",
    createdAt: now()
  });
  saveData(data);
}

function createAsset(user, taskId, filename, fileLink, notes) {
  var data = loadData();
  var payload = {taskId: taskId, filename: filename, fileLink: fileLink};
  taskId = parseInt(taskId);

  if (!taskId || filename === "" || fileLink === "") {
    integrationLog("Asset Uploaded", "FAILED", payload, "Missing required fields");
    return {ok: false, message: "Please fill in the task, file name and file link."};
  }
  var task = data.tasks.find(function (t) { return t.id === taskId; });
  if (!task) {
    integrationLog("Asset Uploaded", "FAILED", payload, "Task not found");
    return {ok: false, message: "Task does not exist."};
  }
  var ext = "." + filename.split(".").pop().toLowerCase();
  if (ALLOWED.indexOf(ext) === -1) {
    integrationLog("Asset Uploaded", "FAILED", payload, "Invalid file type " + ext);
    return {ok: false, message: "File type not allowed. Allowed: " + ALLOWED.join(", ")};
  }
  var dupe = data.assets.find(function (a) { return a.taskId === taskId && a.filename === filename && a.fileLink === fileLink; });
  if (dupe) {
    integrationLog("Asset Uploaded", "FAILED", payload, "Duplicate submission");
    return {ok: false, message: "This file was already submitted."};
  }
  var version = data.assets.filter(function (a) { return a.taskId === taskId; }).length + 1;
  data.assets.unshift({
    id: data.nextId.asset++,
    taskId: taskId,
    filename: filename,
    fileLink: fileLink,
    version: version,
    status: "For Review",
    notes: notes,
    uploadedBy: user,
    uploadedAt: now()
  });
  task.status = "For Review";
  saveData(data);
  notifyRole("reviewer", user + " uploaded " + filename + " (v" + version + ") for task: " + task.title);
  audit("ASSET UPLOADED", filename + " v" + version + " for task " + taskId);
  payload.version = version;
  integrationLog("Asset Uploaded", "SUCCESS", payload, "");
  return {ok: true, message: "Asset submitted as version " + version + ". Task is now For Review."};
}

var FilmFlowAPI = {
  submitAsset: function (taskId, filename, fileLink, notes) {
    return createAsset("api-client", taskId, filename, fileLink, notes || "");
  }
};

var ROUTE_ROLES = {
  "projects": null,
  "project": null,
  "submit": ["admin", "editor"],
  "history": null,
  "review": ["admin", "project_manager", "reviewer"],
  "comments": null,
  "notifications": null,
  "audit": ["admin"],
  "integration": ["admin"],
  "reports": ["admin", "project_manager"],
  "users": ["admin"],
  "backup": ["admin"]
};

function go(hash) {
  window.location.hash = hash;
}

function requireRole(view) {
  var user = currentUser();
  var allowed = ROUTE_ROLES[view];
  if (allowed && allowed.indexOf(user.role) === -1) {
    audit("ACCESS DENIED", "Tried to open " + view);
    return false;
  }
  return true;
}

function renderNav() {
  var user = currentUser();
  var nav = document.getElementById("navBar");
  var header = document.getElementById("headerUser");
  if (!user) {
    nav.innerHTML = "";
    header.innerHTML = "";
    return;
  }
  header.innerHTML = escapeHtml(user.username) + " (" + escapeHtml(user.role) + ") | <a onclick='doLogout()'>Logout</a>";
  var links = ["<a onclick=\"go('dashboard')\">Dashboard</a>", "<a onclick=\"go('projects')\">Projects</a>"];
  if (user.role === "admin" || user.role === "editor") links.push("<a onclick=\"go('submit')\">Submit Asset</a>");
  links.push("<a onclick=\"go('history')\">Version History</a>");
  if (["admin", "project_manager", "reviewer"].indexOf(user.role) !== -1) links.push("<a onclick=\"go('review')\">Review</a>");
  links.push("<a onclick=\"go('notifications')\">Notifications</a>");
  if (["admin", "project_manager"].indexOf(user.role) !== -1) links.push("<a onclick=\"go('reports')\">Reports</a>");
  if (user.role === "admin") {
    links.push("<a onclick=\"go('audit')\">Audit Log</a>");
    links.push("<a onclick=\"go('integration')\">Integration Log</a>");
    links.push("<a onclick=\"go('users')\">Users</a>");
    links.push("<a onclick=\"go('backup')\">Backup</a>");
  }
  nav.innerHTML = links.join("");
}

function render() {
  var user = currentUser();
  var hash = window.location.hash.replace("#", "") || (user ? "dashboard" : "login");
  var parts = hash.split("/");
  var view = parts[0];
  var arg = parts[1];

  if (!user && view !== "login") {
    go("login");
    return;
  }
  if (user && view === "login") {
    go("dashboard");
    return;
  }

  renderNav();
  var app = document.getElementById("app");

  if (view === "login") { app.innerHTML = viewLogin(); return; }
  if (view !== "login" && ROUTE_ROLES[view] !== undefined && !requireRole(view)) {
    app.innerHTML = viewDenied();
    return;
  }

  if (view === "dashboard") app.innerHTML = viewDashboard();
  else if (view === "projects") app.innerHTML = viewProjects();
  else if (view === "project") app.innerHTML = viewProjectDetails(parseInt(arg));
  else if (view === "submit") app.innerHTML = viewSubmit();
  else if (view === "history") app.innerHTML = viewHistory(arg);
  else if (view === "review") app.innerHTML = viewReview();
  else if (view === "comments") app.innerHTML = viewComments(parseInt(arg));
  else if (view === "notifications") app.innerHTML = viewNotifications();
  else if (view === "audit") app.innerHTML = viewAudit();
  else if (view === "integration") app.innerHTML = viewIntegration();
  else if (view === "reports") app.innerHTML = viewReports();
  else if (view === "users") app.innerHTML = viewUsers();
  else if (view === "backup") app.innerHTML = viewBackup();
  else app.innerHTML = viewDashboard();
}

function flashBox(msg) {
  return msg ? "<p class='msg'>" + escapeHtml(msg) + "</p>" : "";
}

function viewLogin() {
  return "<h3>Login</h3>" +
    "<form class='box' onsubmit='return doLogin(event)'>" +
    "Username<br><input type='text' id='loginUser'><br>" +
    "Password<br><input type='password' id='loginPass'><br><br>" +
    "<button type='submit'>Login</button>" +
    "<p id='loginMsg'></p>" +
    "</form>" +
    "<p>Demo: admin/admin123, pm/pm123, editor/editor123, reviewer/reviewer123, client/client123</p>";
}

function doLogin(e) {
  e.preventDefault();
  var username = document.getElementById("loginUser").value.trim();
  var password = document.getElementById("loginPass").value;
  var data = loadData();
  var user = data.users.find(function (u) { return u.username === username && u.password === password; });
  if (user) {
    sessionStorage.setItem("filmflow_user", JSON.stringify({id: user.id, username: user.username, role: user.role}));
    audit("LOGIN", "Logged in");
    go("dashboard");
  } else {
    data.auditLogs.unshift({id: data.nextId.audit++, username: username || "unknown", action: "LOGIN FAILED", details: "Wrong login for " + username, createdAt: now()});
    saveData(data);
    document.getElementById("loginMsg").innerHTML = "Wrong username or password.";
  }
  return false;
}

function doLogout() {
  audit("LOGOUT", "Logged out");
  sessionStorage.removeItem("filmflow_user");
  go("login");
}

function viewDenied() {
  return "<h3>Access Denied</h3><p>Your role is not allowed to open this page. This attempt was recorded in the audit log.</p><a onclick=\"go('dashboard')\">Back to dashboard</a>";
}

function viewDashboard() {
  var data = loadData();
  var counts = {projects: data.projects.length, tasks: data.tasks.length,
    pending: data.tasks.filter(function (t) { return t.status === "Pending"; }).length,
    review: data.tasks.filter(function (t) { return t.status === "For Review"; }).length,
    approved: data.tasks.filter(function (t) { return t.status === "Approved"; }).length,
    rejected: data.tasks.filter(function (t) { return t.status === "Rejected" || t.status === "Revision"; }).length};
  var recent = data.auditLogs.slice(0, 5);
  var html = "<h3>Dashboard</h3><div class='cards'>" +
    "<div><b>" + counts.projects + "</b>Projects</div>" +
    "<div><b>" + counts.tasks + "</b>Total Tasks</div>" +
    "<div><b>" + counts.pending + "</b>Pending</div>" +
    "<div><b>" + counts.review + "</b>For Review</div>" +
    "<div><b>" + counts.approved + "</b>Approved</div>" +
    "<div><b>" + counts.rejected + "</b>Rejected / Revision</div>" +
    "</div><h4>Recent Activity</h4><table><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr>";
  recent.forEach(function (r) {
    html += "<tr><td>" + escapeHtml(r.createdAt) + "</td><td>" + escapeHtml(r.username) + "</td><td>" + escapeHtml(r.action) + "</td><td>" + escapeHtml(r.details) + "</td></tr>";
  });
  html += "</table>";
  return html;
}

function viewProjects() {
  var data = loadData();
  var user = currentUser();
  var html = "<h3>Project List</h3><table><tr><th>ID</th><th>Title</th><th>Description</th><th>Status</th><th>Created By</th><th></th></tr>";
  data.projects.forEach(function (p) {
    html += "<tr><td>" + p.id + "</td><td>" + escapeHtml(p.title) + "</td><td>" + escapeHtml(p.description) + "</td><td>" + escapeHtml(p.status) + "</td><td>" + escapeHtml(p.createdBy) + "</td><td><a onclick=\"go('project/" + p.id + "')\">View</a></td></tr>";
  });
  html += "</table>";
  if (user.role === "admin" || user.role === "project_manager") {
    html += "<div class='box'><h4>Create Project</h4>" +
      "<form onsubmit='return addProject(event)'>" +
      "Title<br><input type='text' id='pTitle'><br>" +
      "Description<br><textarea id='pDesc'></textarea><br>" +
      "<button type='submit'>Create</button></form></div>";
  }
  return html;
}

function addProject(e) {
  e.preventDefault();
  var title = document.getElementById("pTitle").value.trim();
  var desc = document.getElementById("pDesc").value.trim();
  if (title === "") { alert("Project title is required."); return false; }
  var data = loadData();
  var user = currentUser();
  data.projects.unshift({id: data.nextId.project++, title: title, description: desc, status: "Ongoing", createdBy: user.username, createdAt: now()});
  saveData(data);
  audit("PROJECT CREATED", title);
  go("projects");
  render();
  return false;
}

function viewProjectDetails(id) {
  var data = loadData();
  var user = currentUser();
  var project = data.projects.find(function (p) { return p.id === id; });
  if (!project) return "<p>Project not found.</p><a onclick=\"go('projects')\">Back</a>";
  var tasks = data.tasks.filter(function (t) { return t.projectId === id; });
  var editors = data.users.filter(function (u) { return u.role === "editor"; });
  var html = "<h3>Project Details</h3><div class='box'><b>" + escapeHtml(project.title) + "</b><br>" +
    escapeHtml(project.description) + "<br>Status: " + escapeHtml(project.status) + " | Created by: " + escapeHtml(project.createdBy) + " on " + escapeHtml(project.createdAt) + "</div>" +
    "<h4>Tasks</h4><table><tr><th>ID</th><th>Task</th><th>Stage</th><th>Assigned To</th><th>Status</th><th>Due Date</th></tr>";
  tasks.forEach(function (t) {
    html += "<tr><td>" + t.id + "</td><td>" + escapeHtml(t.title) + "</td><td>" + escapeHtml(t.stage) + "</td><td>" + escapeHtml(t.assignedTo) + "</td><td>" + escapeHtml(t.status) + "</td><td>" + escapeHtml(t.dueDate) + "</td></tr>";
  });
  html += "</table>";
  if (user.role === "admin" || user.role === "project_manager") {
    html += "<div class='box'><h4>Add Task</h4><form onsubmit='return addTask(event, " + id + ")'>" +
      "Task title<br><input type='text' id='tTitle'><br>" +
      "Stage<br><select id='tStage'>" + STAGES.map(function (s) { return "<option>" + s + "</option>"; }).join("") + "</select><br>" +
      "Assign to<br><select id='tAssigned'>" + editors.map(function (e) { return "<option>" + escapeHtml(e.username) + "</option>"; }).join("") + "</select><br>" +
      "Due date<br><input type='date' id='tDue'><br>" +
      "<button type='submit'>Add Task</button></form></div>";
  }
  html += "<a onclick=\"go('projects')\">Back</a>";
  return html;
}

function addTask(e, projectId) {
  e.preventDefault();
  var title = document.getElementById("tTitle").value.trim();
  var stage = document.getElementById("tStage").value;
  var assigned = document.getElementById("tAssigned").value;
  var due = document.getElementById("tDue").value;
  if (title === "" || due === "") { alert("Task title and due date are required."); return false; }
  var data = loadData();
  data.tasks.push({id: data.nextId.task++, projectId: projectId, title: title, stage: stage, assignedTo: assigned, status: "Pending", dueDate: due});
  saveData(data);
  audit("TASK CREATED", title + " in project " + projectId);
  render();
  return false;
}

function viewSubmit() {
  var data = loadData();
  var tasks = data.tasks.map(function (t) {
    var p = data.projects.find(function (pr) { return pr.id === t.projectId; });
    return {id: t.id, title: t.title, ptitle: p ? p.title : ""};
  });
  var html = "<h3>Asset / Task Submission Form</h3><p>Submitting calls FilmFlowAPI.submitAsset() in app.js, the same function a real API endpoint would run.</p><div class='box'>" +
    "Task<br><select id='subTask'><option value=''>-- choose task --</option>" +
    tasks.map(function (t) { return "<option value='" + t.id + "'>" + escapeHtml(t.ptitle + " - " + t.title) + "</option>"; }).join("") +
    "</select><br>File name (example: scene1_cut.mp4)<br><input type='text' id='subFile'><br>" +
    "File link (Google Drive, etc.)<br><input type='text' id='subLink'><br>" +
    "Notes<br><textarea id='subNotes'></textarea><br>" +
    "<button onclick='submitAssetForm()'>Submit</button><p id='subResult'></p></div>";
  return html;
}

function submitAssetForm() {
  var taskId = document.getElementById("subTask").value;
  var filename = document.getElementById("subFile").value.trim();
  var fileLink = document.getElementById("subLink").value.trim();
  var notes = document.getElementById("subNotes").value.trim();
  var user = currentUser();
  var result = createAsset(user.username, taskId, filename, fileLink, notes);
  document.getElementById("subResult").innerText = (result.ok ? "success: " : "error: ") + result.message;
}

function viewHistory(taskFilter) {
  var data = loadData();
  var assets = data.assets.slice().sort(function (a, b) { return a.taskId - b.taskId || a.version - b.version; });
  if (taskFilter) assets = assets.filter(function (a) { return a.taskId === parseInt(taskFilter); });
  var html = "<h3>Asset Version History</h3><form class='small' onsubmit='return filterHistory(event)'>Filter by task: " +
    "<select id='histTaskFilter'><option value=''>All</option>" +
    data.tasks.map(function (t) { return "<option value='" + t.id + "'" + (taskFilter == t.id ? " selected" : "") + ">" + escapeHtml(t.title) + "</option>"; }).join("") +
    "</select><button type='submit'>Filter</button></form><br>" +
    "<table><tr><th>Task</th><th>File</th><th>Version</th><th>Status</th><th>Uploaded By</th><th>Date</th><th>Link</th><th></th></tr>";
  assets.forEach(function (a) {
    var t = data.tasks.find(function (tt) { return tt.id === a.taskId; });
    html += "<tr><td>" + escapeHtml(t ? t.title : "") + "</td><td>" + escapeHtml(a.filename) + "</td><td>v" + a.version + "</td><td>" + escapeHtml(a.status) + "</td><td>" + escapeHtml(a.uploadedBy) + "</td><td>" + escapeHtml(a.uploadedAt) + "</td><td><a href='" + escapeHtml(a.fileLink) + "' target='_blank'>open</a></td><td><a onclick=\"go('comments/" + a.id + "')\">Comments</a></td></tr>";
  });
  html += "</table>";
  return html;
}

function filterHistory(e) {
  e.preventDefault();
  var val = document.getElementById("histTaskFilter").value;
  go("history" + (val ? "/" + val : ""));
  render();
  return false;
}

function viewReview() {
  var data = loadData();
  var assets = data.assets.filter(function (a) { return a.status === "For Review"; });
  var html = "<h3>Review and Approval</h3>";
  if (assets.length === 0) html += "<p>No assets waiting for review.</p>";
  assets.forEach(function (a) {
    var t = data.tasks.find(function (tt) { return tt.id === a.taskId; });
    html += "<div class='box'><b>" + escapeHtml(a.filename) + "</b> (v" + a.version + ") - Task: " + escapeHtml(t ? t.title : "") + "<br>" +
      "Uploaded by " + escapeHtml(a.uploadedBy) + " on " + escapeHtml(a.uploadedAt) + "<br>Notes: " + escapeHtml(a.notes) + "<br>" +
      "<a href='" + escapeHtml(a.fileLink) + "' target='_blank'>Open file</a> | <a onclick=\"go('comments/" + a.id + "')\">View comments</a>" +
      "<form onsubmit='return false'><textarea id='comment" + a.id + "' placeholder='Comment (required for reject / revision)'></textarea><br>" +
      "<button onclick='reviewAction(" + a.id + ", \"approve\")'>Approve</button>" +
      "<button onclick='reviewAction(" + a.id + ", \"revision\")'>Request Revision</button>" +
      "<button onclick='reviewAction(" + a.id + ", \"reject\")'>Reject</button></form></div>";
  });
  return html;
}

function reviewAction(assetId, decision) {
  var data = loadData();
  var asset = data.assets.find(function (a) { return a.id === assetId; });
  if (!asset || asset.status !== "For Review") { alert("This asset is not waiting for review."); return; }
  var comment = document.getElementById("comment" + assetId).value.trim();
  var assetStatus, taskStatus, event;
  if (decision === "approve") { assetStatus = "Approved"; taskStatus = "Approved"; event = "Final Output Approved"; }
  else if (decision === "reject") { assetStatus = "Rejected"; taskStatus = "Rejected"; event = "Asset Rejected"; }
  else { assetStatus = "Revision Requested"; taskStatus = "Revision"; event = "Revision Requested"; }
  if (decision !== "approve" && comment === "") { alert("Please write a comment when rejecting or requesting revision."); return; }
  asset.status = assetStatus;
  var task = data.tasks.find(function (t) { return t.id === asset.taskId; });
  if (task) task.status = taskStatus;
  if (comment) {
    var user = currentUser();
    data.comments.push({id: data.nextId.comment++, assetId: assetId, username: user.username, text: comment, createdAt: now()});
  }
  saveData(data);
  notifyUser(asset.uploadedBy, asset.filename + " was updated: " + assetStatus);
  audit(assetStatus.toUpperCase(), asset.filename + " v" + asset.version);
  var user = currentUser();
  integrationLog(event, "SUCCESS", {assetId: assetId, filename: asset.filename, by: user.username}, "");
  render();
}

function viewComments(assetId) {
  var data = loadData();
  var asset = data.assets.find(function (a) { return a.id === assetId; });
  if (!asset) return "<p>Asset not found.</p><a onclick=\"go('history')\">Back</a>";
  var comments = data.comments.filter(function (c) { return c.assetId === assetId; });
  var html = "<h3>Comments / Feedback</h3><div class='box'>" + escapeHtml(asset.filename) + " (v" + asset.version + ") - Status: " + escapeHtml(asset.status) + "</div>" +
    "<table><tr><th>Time</th><th>User</th><th>Comment</th></tr>";
  comments.forEach(function (c) {
    html += "<tr><td>" + escapeHtml(c.createdAt) + "</td><td>" + escapeHtml(c.username) + "</td><td>" + escapeHtml(c.text) + "</td></tr>";
  });
  html += "</table><form class='box' onsubmit='return addComment(event, " + assetId + ")'><textarea id='newComment'></textarea><br><button type='submit'>Add Comment</button></form>" +
    "<a onclick=\"go('history')\">Back</a>";
  return html;
}

function addComment(e, assetId) {
  e.preventDefault();
  var text = document.getElementById("newComment").value.trim();
  if (text === "") { alert("Comment cannot be empty."); return false; }
  var data = loadData();
  var user = currentUser();
  data.comments.push({id: data.nextId.comment++, assetId: assetId, username: user.username, text: text, createdAt: now()});
  saveData(data);
  audit("COMMENT ADDED", "On asset " + assetId);
  render();
  return false;
}

function viewNotifications() {
  var data = loadData();
  var user = currentUser();
  var notes = data.notifications.filter(function (n) { return n.userId === user.id; });
  notes.forEach(function (n) { n.isRead = true; });
  saveData(data);
  var html = "<h3>Notification Log</h3><table><tr><th>Time</th><th>Message</th><th>Read</th></tr>";
  notes.forEach(function (n) {
    html += "<tr><td>" + escapeHtml(n.createdAt) + "</td><td>" + escapeHtml(n.message) + "</td><td>" + (n.isRead ? "Yes" : "New") + "</td></tr>";
  });
  html += "</table>";
  return html;
}

function viewAudit() {
  var data = loadData();
  var html = "<h3>Audit Log</h3><table><tr><th>ID</th><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr>";
  data.auditLogs.forEach(function (l) {
    html += "<tr><td>" + l.id + "</td><td>" + escapeHtml(l.createdAt) + "</td><td>" + escapeHtml(l.username) + "</td><td>" + escapeHtml(l.action) + "</td><td>" + escapeHtml(l.details) + "</td></tr>";
  });
  html += "</table>";
  return html;
}

function viewIntegration() {
  var data = loadData();
  var html = "<h3>Integration Log (events)</h3><table><tr><th>ID</th><th>Time</th><th>Event</th><th>Status</th><th>Payload</th><th>Error</th></tr>";
  data.integrationLogs.forEach(function (l) {
    html += "<tr><td>" + l.id + "</td><td>" + escapeHtml(l.createdAt) + "</td><td>" + escapeHtml(l.event) + "</td><td>" + escapeHtml(l.status) + "</td><td>" + escapeHtml(l.payload) + "</td><td>" + escapeHtml(l.error) + "</td></tr>";
  });
  html += "</table>";
  return html;
}

function viewReports() {
  var data = loadData();
  var html = "<h3>Reports</h3><h4>Project Progress</h4><table><tr><th>Project</th><th>Total Tasks</th><th>Approved</th><th>Progress</th></tr>";
  data.projects.forEach(function (p) {
    var tasks = data.tasks.filter(function (t) { return t.projectId === p.id; });
    var done = tasks.filter(function (t) { return t.status === "Approved"; }).length;
    var percent = tasks.length === 0 ? 0 : Math.round(done * 100 / tasks.length);
    html += "<tr><td>" + escapeHtml(p.title) + "</td><td>" + tasks.length + "</td><td>" + done + "</td><td>" + percent + "%</td></tr>";
  });
  html += "</table><h4>Overdue Tasks</h4><table><tr><th>Task</th><th>Stage</th><th>Assigned To</th><th>Status</th><th>Due Date</th></tr>";
  var today = new Date().toISOString().split("T")[0];
  data.tasks.filter(function (t) { return t.dueDate < today && t.status !== "Approved"; }).forEach(function (t) {
    html += "<tr><td>" + escapeHtml(t.title) + "</td><td>" + escapeHtml(t.stage) + "</td><td>" + escapeHtml(t.assignedTo) + "</td><td>" + escapeHtml(t.status) + "</td><td>" + escapeHtml(t.dueDate) + "</td></tr>";
  });
  html += "</table>";
  return html;
}

function viewUsers() {
  var data = loadData();
  var html = "<h3>User and Role Management</h3><table><tr><th>ID</th><th>Username</th><th>Role</th><th>Change Role</th></tr>";
  data.users.forEach(function (u) {
    html += "<tr><td>" + u.id + "</td><td>" + escapeHtml(u.username) + "</td><td>" + escapeHtml(u.role) + "</td><td>" +
      "<select id='roleSel" + u.id + "'>" + ROLES.map(function (r) { return "<option" + (r === u.role ? " selected" : "") + ">" + r + "</option>"; }).join("") + "</select>" +
      "<button onclick='changeRole(" + u.id + ")'>Save</button></td></tr>";
  });
  html += "</table><div class='box'><h4>Add User</h4><form onsubmit='return addUser(event)'>" +
    "Username<br><input type='text' id='newUserName'><br>" +
    "Password<br><input type='password' id='newUserPass'><br>" +
    "Role<br><select id='newUserRole'>" + ROLES.map(function (r) { return "<option>" + r + "</option>"; }).join("") + "</select><br>" +
    "<button type='submit'>Add User</button></form></div>";
  return html;
}

function changeRole(userId) {
  var role = document.getElementById("roleSel" + userId).value;
  var data = loadData();
  var u = data.users.find(function (x) { return x.id === userId; });
  u.role = role;
  saveData(data);
  audit("ROLE CHANGED", "User " + userId + " is now " + role);
  render();
}

function addUser(e) {
  e.preventDefault();
  var username = document.getElementById("newUserName").value.trim();
  var password = document.getElementById("newUserPass").value;
  var role = document.getElementById("newUserRole").value;
  var data = loadData();
  if (username === "" || password.length < 6) { alert("Username required, password needs at least 6 characters."); return false; }
  if (data.users.find(function (u) { return u.username === username; })) { alert("Username already exists."); return false; }
  data.users.push({id: data.nextId.user++, username: username, password: password, role: role});
  saveData(data);
  audit("USER CREATED", username + " as " + role);
  render();
  return false;
}

function viewBackup() {
  return "<h3>Backup</h3><div class='box'>" +
    "<p>Download a copy of all current data as a JSON file.</p>" +
    "<button onclick='downloadBackup()'>Download Backup</button>" +
    "<p>Restore data from a previously downloaded backup file.</p>" +
    "<input type='file' id='restoreFile'>" +
    "<button onclick='restoreBackup()'>Restore</button></div>";
}

function downloadBackup() {
  var data = loadData();
  var blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "filmflow_backup_" + Date.now() + ".json";
  a.click();
  audit("BACKUP", "Backup downloaded");
}

function restoreBackup() {
  var fileInput = document.getElementById("restoreFile");
  if (!fileInput.files.length) { alert("Choose a backup file first."); return; }
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var parsed = JSON.parse(reader.result);
      saveData(parsed);
      audit("BACKUP", "Backup restored");
      render();
    } catch (err) {
      alert("That file is not a valid backup.");
    }
  };
  reader.readAsText(fileInput.files[0]);
}

window.addEventListener("hashchange", render);
window.addEventListener("load", render);
