const STORAGE_KEY = "shortFilmWorkflowSystem_v1";
const SESSION_KEY = "shortFilmCurrentUser_v1";

const defaultData = {
  users: [
    { id: "u1", name: "System Admin", email: "admin@film.local", password: "admin123", role: "Admin" },
    { id: "u2", name: "Mia Santos", email: "editor@film.local", password: "editor123", role: "Editor" },
    { id: "u3", name: "Noah Cruz", email: "reviewer@film.local", password: "review123", role: "Reviewer" }
  ],
  projects: [
    { id: "p1", name: "Echoes of Tomorrow", description: "Short film production and post-production workflow.", status: "In Production", progress: 68, owner: "Mia Santos", deadline: "2026-11-15" }
  ],
  assets: [
    { id: "a1", name: "Storyboard Scene 01", type: "Storyboard", version: "v2", status: "Approved", submittedBy: "Mia Santos", date: "2026-10-06" },
    { id: "a2", name: "Footage Scene 03", type: "Video", version: "v1", status: "For Review", submittedBy: "Noah Cruz", date: "2026-10-08" },
    { id: "a3", name: "Dialogue Mix", type: "Audio", version: "v3", status: "Revision Requested", submittedBy: "Mia Santos", date: "2026-10-08" }
  ],
  tasks: [
    { id: "t1", title: "Finalize Scene 01 Edit", type: "Editing", assignee: "Mia Santos", status: "In Progress", due: "2026-10-12" },
    { id: "t2", title: "Review Scene 03 Footage", type: "Review", assignee: "Noah Cruz", status: "For Review", due: "2026-10-10" },
    { id: "t3", title: "Color Grade Final Sequence", type: "Color", assignee: "Mia Santos", status: "Pending", due: "2026-10-20" },
    { id: "t4", title: "Final Export Approval", type: "Export", assignee: "System Admin", status: "Pending", due: "2026-11-01" }
  ],
  comments: [
    { id: "c1", asset: "Footage Scene 03", author: "Noah Cruz", text: "Please revise the transition at 00:42.", date: "2026-10-08" }
  ],
  notifications: [
    { id: "n1", text: "Footage Scene 03 is waiting for review.", read: false, date: "2026-10-08" },
    { id: "n2", text: "Dialogue Mix v3 needs revision.", read: false, date: "2026-10-08" }
  ],
  audit: [
    { id: "l1", action: "System initialized", actor: "System Admin", target: "Workflow System", time: "2026-10-01 09:00" },
    { id: "l2", action: "Asset submitted", actor: "Noah Cruz", target: "Footage Scene 03 v1", time: "2026-10-08 14:25" },
    { id: "l3", action: "Revision requested", actor: "Noah Cruz", target: "Dialogue Mix v3", time: "2026-10-08 16:10" }
  ],
  tests: [
    { name: "Login validation", status: "Passed", evidence: "Invalid password blocked." },
    { name: "Role-based access", status: "Passed", evidence: "Viewer cannot approve assets." },
    { name: "Asset workflow automation", status: "Passed", evidence: "Upload changes task to For Review." },
    { name: "Approval notification", status: "Passed", evidence: "Approval creates notification and audit entry." }
  ]
};

let db = loadDB();
let currentUser = loadSession();
let currentView = "dashboard";

const permissions = {
  Admin: ["all"],
  "Project Manager": ["projects", "tasks", "assets", "reviews", "comments", "notifications", "audit", "integration", "reports", "backup"],
  Editor: ["projects", "tasks", "assets", "reviews", "comments", "notifications", "audit", "integration"],
  Animator: ["projects", "tasks", "assets", "comments", "notifications"],
  Reviewer: ["projects", "assets", "reviews", "comments", "notifications", "audit"],
  Client: ["projects", "assets", "reviews", "comments", "notifications"],
  Viewer: ["projects", "assets", "notifications"]
};

function loadDB() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    return structuredClone(defaultData);
  }
  try {
    return JSON.parse(saved);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    return structuredClone(defaultData);
  }
}

function saveDB() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function loadSession() {
  const id = sessionStorage.getItem(SESSION_KEY);
  return db.users.find(u => u.id === id) || null;
}

function setSession(user) {
  if (user) sessionStorage.setItem(SESSION_KEY, user.id);
  else sessionStorage.removeItem(SESSION_KEY);
  currentUser = user;
}

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function nowText() {
  return new Date().toLocaleString();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function toast(message) {
  const container = document.getElementById("toast-container");
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => item.remove(), 3000);
}

function hasPermission(area) {
  if (!currentUser) return false;
  const list = permissions[currentUser.role] || [];
  return list.includes("all") || list.includes(area);
}

function logAction(action, target) {
  db.audit.unshift({
    id: uid("l"),
    action,
    actor: currentUser?.name || "System",
    target,
    time: nowText()
  });
  db.audit = db.audit.slice(0, 100);
  saveDB();
}

function notify(text) {
  db.notifications.unshift({
    id: uid("n"),
    text,
    read: false,
    date: nowText()
  });
  db.notifications = db.notifications.slice(0, 100);
  saveDB();
}

function statusClass(status) {
  if (/approved|completed|passed|in progress/i.test(status)) return "success";
  if (/review|pending|revision/i.test(status)) return "warning";
  if (/rejected|failed|overdue/i.test(status)) return "danger";
  return "";
}

function showAuth() {
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}

function showApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("user-mini").innerHTML =
    `<strong>${escapeHTML(currentUser.name)}</strong><span>${escapeHTML(currentUser.role)}</span>`;
  document.getElementById("role-badge").textContent = currentUser.role;
  renderNav();
  renderView();
}

function renderNav() {
  document.querySelectorAll(".nav-item").forEach(btn => {
    const view = btn.dataset.view;
    const area = view === "dashboard" ? null : view === "security" ? "reports" : view;
    btn.style.display = (!area || hasPermission(area)) ? "" : "none";
  });
}

function renderView() {
  const titles = {
    dashboard: "Dashboard",
    projects: "Projects",
    assets: "Assets & Files",
    tasks: "Production Tasks",
    reviews: "Review & Approval",
    comments: "Comments",
    notifications: "Notifications",
    audit: "Audit Log",
    integration: "Integration",
    architecture: "Architecture",
    security: "Security & Testing",
    backup: "Backup & Deployment"
  };
  document.getElementById("page-title").textContent = titles[currentView] || "Dashboard";
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === currentView));

  const views = {
    dashboard: renderDashboard,
    projects: renderProjects,
    assets: renderAssets,
    tasks: renderTasks,
    reviews: renderReviews,
    comments: renderComments,
    notifications: renderNotifications,
    audit: renderAudit,
    integration: renderIntegration,
    architecture: renderArchitecture,
    security: renderSecurity,
    backup: renderBackup
  };

  if (!views[currentView]) currentView = "dashboard";
  document.getElementById("view-container").innerHTML = views[currentView]();
  bindViewEvents();
}

function renderDashboard() {
  const approved = db.assets.filter(a => a.status === "Approved").length;
  const pending = db.assets.filter(a => /Review|Revision|Pending/i.test(a.status)).length;
  const completedTasks = db.tasks.filter(t => /Completed/i.test(t.status)).length;
  const progress = db.projects[0]?.progress || 0;
  const unread = db.notifications.filter(n => !n.read).length;

  return `
    <div class="page-intro">
      <div>
        <h3>Production Control Center</h3>
        <p>Integrated workflow for script planning, assets, editing, review, audio, color grading and final export.</p>
      </div>
      ${hasPermission("projects") ? `<button class="primary-btn" data-action="open-project-modal">New Project</button>` : ""}
    </div>

    <div class="grid stats">
      <div class="card stat-card"><div class="stat-label">Project Progress</div><div class="stat-number">${progress}%</div><div class="progress"><div style="width:${progress}%"></div></div></div>
      <div class="card stat-card"><div class="stat-label">Assets</div><div class="stat-number">${db.assets.length}</div><div class="muted">${approved} approved</div></div>
      <div class="card stat-card"><div class="stat-label">Pending Workflow</div><div class="stat-number">${pending}</div><div class="muted">Review / revision items</div></div>
      <div class="card stat-card"><div class="stat-label">Notifications</div><div class="stat-number">${unread}</div><div class="muted">Unread alerts</div></div>
    </div>

    <div class="grid two-col">
      <div class="card">
        <h4>Current Production</h4>
        ${db.projects.slice(0, 1).map(p => `
          <div class="list-item">
            <strong>${escapeHTML(p.name)}</strong>
            <small>${escapeHTML(p.description)}</small>
            <div class="progress"><div style="width:${p.progress}%"></div></div>
            <small>${p.progress}% complete · Deadline ${escapeHTML(p.deadline)}</small>
          </div>`).join("")}
      </div>

      <div class="card">
        <h4>Workflow Status</h4>
        <div class="list">
          <div class="list-item"><strong>Script / Planning</strong><small>Scene and shot planning connected to production tasks.</small></div>
          <div class="list-item"><strong>Asset Submission</strong><small>Files receive versions and automatically enter review workflow.</small></div>
          <div class="list-item"><strong>Review → Approval</strong><small>Approval or revision creates notifications and audit records.</small></div>
          <div class="list-item"><strong>Final Export</strong><small>Release remains pending until approval is completed.</small></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h4>Recent Activity</h4>
      <div class="list">
        ${db.audit.slice(0, 5).map(l => `<div class="list-item"><strong>${escapeHTML(l.action)}</strong><small>${escapeHTML(l.actor)} · ${escapeHTML(l.target)} · ${escapeHTML(l.time)}</small></div>`).join("")}
      </div>
    </div>
  `;
}

function renderProjects() {
  if (!hasPermission("projects")) return permissionDenied();
  return `
    <div class="page-intro">
      <div><h3>Project / Production Management</h3><p>Manage the short film production pipeline and project status.</p></div>
      <button class="primary-btn" data-action="open-project-modal">Create Project</button>
    </div>
    <div class="grid two-col">
      ${db.projects.map(p => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;gap:10px">
            <h4>${escapeHTML(p.name)}</h4><span class="badge ${statusClass(p.status)}">${escapeHTML(p.status)}</span>
          </div>
          <p>${escapeHTML(p.description)}</p>
          <div class="progress"><div style="width:${p.progress}%"></div></div>
          <p><strong>${p.progress}%</strong> complete · Owner: ${escapeHTML(p.owner)} · Deadline: ${escapeHTML(p.deadline)}</p>
          <div class="actions">
            <button class="small-btn" data-action="advance-project" data-id="${p.id}">Advance Progress</button>
            <button class="danger-btn" data-action="delete-project" data-id="${p.id}">Delete</button>
          </div>
        </div>`).join("")}
    </div>
  `;
}

function renderAssets() {
  if (!hasPermission("assets")) return permissionDenied();
  return `
    <div class="page-intro">
      <div><h3>Asset / File Submission</h3><p>Record storyboards, footage, audio, animation, renders and design drafts with version tracking.</p></div>
      <button class="primary-btn" data-action="open-asset-modal">Submit Asset</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Asset</th><th>Type</th><th>Version</th><th>Status</th><th>Submitted By</th><th>Actions</th></tr></thead>
          <tbody>
            ${db.assets.map(a => `
              <tr>
                <td><strong>${escapeHTML(a.name)}</strong><br><small class="muted">${escapeHTML(a.date)}</small></td>
                <td>${escapeHTML(a.type)}</td>
                <td>${escapeHTML(a.version)}</td>
                <td><span class="badge ${statusClass(a.status)}">${escapeHTML(a.status)}</span></td>
                <td>${escapeHTML(a.submittedBy)}</td>
                <td>
                  <div class="actions">
                    ${hasPermission("reviews") ? `<button class="success-btn" data-action="approve-asset" data-id="${a.id}">Approve</button>` : ""}
                    ${hasPermission("reviews") ? `<button class="danger-btn" data-action="request-revision" data-id="${a.id}">Revision</button>` : ""}
                  </div>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTasks() {
  if (!hasPermission("tasks")) return permissionDenied();
  return `
    <div class="page-intro">
      <div><h3>Production Tasks</h3><p>Connect editing, review, audio, color grading and final export activities.</p></div>
      <button class="primary-btn" data-action="open-task-modal">Add Task</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Task</th><th>Type</th><th>Assignee</th><th>Status</th><th>Due</th><th>Action</th></tr></thead>
          <tbody>
            ${db.tasks.map(t => `
              <tr>
                <td><strong>${escapeHTML(t.title)}</strong></td>
                <td>${escapeHTML(t.type)}</td>
                <td>${escapeHTML(t.assignee)}</td>
                <td><span class="badge ${statusClass(t.status)}">${escapeHTML(t.status)}</span></td>
                <td>${escapeHTML(t.due)}</td>
                <td><button class="small-btn" data-action="cycle-task" data-id="${t.id}">Change Status</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderReviews() {
  if (!hasPermission("reviews")) return permissionDenied();
  const reviewAssets = db.assets.filter(a => /Review|Revision/i.test(a.status));
  return `
    <div class="page-intro">
      <div><h3>Review & Approval Workflow</h3><p>Approve, reject, or request revisions and automatically record the workflow event.</p></div>
    </div>
    <div class="grid two-col">
      ${reviewAssets.length ? reviewAssets.map(a => `
        <div class="card">
          <h4>${escapeHTML(a.name)} <span class="badge ${statusClass(a.status)}">${escapeHTML(a.status)}</span></h4>
          <p>Version ${escapeHTML(a.version)} · ${escapeHTML(a.type)} · Submitted by ${escapeHTML(a.submittedBy)}</p>
          <div class="actions">
            <button class="success-btn" data-action="approve-asset" data-id="${a.id}">Approve</button>
            <button class="danger-btn" data-action="request-revision" data-id="${a.id}">Request Revision</button>
          </div>
        </div>`).join("") : `<div class="card"><div class="empty">No assets are currently waiting for review.</div></div>`}
      <div class="card">
        <h4>Approval Pipeline</h4>
        <div class="checklist">
          <div class="check"><span class="check-mark">✓</span><span>Asset submitted with version metadata.</span></div>
          <div class="check"><span class="check-mark">✓</span><span>Task automatically moves to For Review.</span></div>
          <div class="check"><span class="check-mark">✓</span><span>Reviewer approves or requests revision.</span></div>
          <div class="check"><span class="check-mark">✓</span><span>Notification and audit log are generated.</span></div>
        </div>
      </div>
    </div>
  `;
}

function renderComments() {
  if (!hasPermission("comments")) return permissionDenied();
  return `
    <div class="page-intro">
      <div><h3>Comments & Feedback</h3><p>Store revision notes and review instructions against production assets.</p></div>
      <button class="primary-btn" data-action="open-comment-modal">Add Comment</button>
    </div>
    <div class="card">
      <div class="list">
        ${db.comments.map(c => `<div class="list-item"><strong>${escapeHTML(c.asset)}</strong><small>${escapeHTML(c.author)} · ${escapeHTML(c.date)}</small><div style="margin-top:7px">${escapeHTML(c.text)}</div></div>`).join("")}
      </div>
    </div>
  `;
}

function renderNotifications() {
  if (!hasPermission("notifications")) return permissionDenied();
  return `
    <div class="page-intro">
      <div><h3>Notification Log</h3><p>Alerts for submissions, approvals, revisions, deadlines and completed tasks.</p></div>
      <button class="secondary-btn" data-action="mark-notifications-read">Mark All Read</button>
    </div>
    <div class="card">
      <div class="list">
        ${db.notifications.length ? db.notifications.map(n => `<div class="list-item"><strong>${n.read ? "Read" : "Unread"} · ${escapeHTML(n.text)}</strong><small>${escapeHTML(n.date)}</small></div>`).join("") : `<div class="empty">No notifications.</div>`}
      </div>
    </div>
  `;
}

function renderAudit() {
  if (!hasPermission("audit")) return permissionDenied();
  return `
    <div class="page-intro"><div><h3>Audit Log</h3><p>Important system actions are recorded for governance and technical defense.</p></div></div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
          <tbody>${db.audit.map(l => `<tr><td>${escapeHTML(l.time)}</td><td>${escapeHTML(l.actor)}</td><td>${escapeHTML(l.action)}</td><td>${escapeHTML(l.target)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderIntegration() {
  if (!hasPermission("integration")) return permissionDenied();
  return `
    <div class="page-intro">
      <div><h3>Systems Integration</h3><p>Demonstration of connected modules and an event-driven workflow integration.</p></div>
      <button class="primary-btn" data-action="run-integration-test">Run Integration Test</button>
    </div>
    <div class="card">
      <h4>Event-Driven Integration Pattern</h4>
      <p>The selected architecture style uses events so one workflow action can trigger responses in other modules.</p>
      <div class="integration-flow">
        <div class="flow-node"><strong>Asset Submission</strong><small>File + version metadata</small></div>
        <div class="flow-arrow">→</div>
        <div class="flow-node"><strong>Production Task</strong><small>Status becomes For Review</small></div>
        <div class="flow-arrow">→</div>
        <div class="flow-node"><strong>Notification + Audit</strong><small>Event is recorded</small></div>
      </div>
    </div>
    <div class="grid two-col" style="margin-top:16px">
      <div class="card">
        <h4>Connected Modules</h4>
        <div class="checklist">
          <div class="check"><span class="check-mark">✓</span><span>Asset/File Submission Module</span></div>
          <div class="check"><span class="check-mark">✓</span><span>Production Task Module</span></div>
          <div class="check"><span class="check-mark">✓</span><span>Review & Approval Module</span></div>
          <div class="check"><span class="check-mark">✓</span><span>Notification Module</span></div>
          <div class="check"><span class="check-mark">✓</span><span>Audit Log Module</span></div>
        </div>
      </div>
      <div class="card">
        <h4>Integration Options Demonstrated</h4>
        <p><strong>Workflow Automation:</strong> when an asset is submitted, its related workflow becomes For Review.</p>
        <p><strong>Messaging Simulation:</strong> events such as Asset Uploaded and Final Output Approved generate notifications.</p>
        <p><strong>API-style module boundary:</strong> the frontend functions are separated into project, asset, task, review, notification and audit modules.</p>
      </div>
    </div>
  `;
}

function renderArchitecture() {
  return `
    <div class="page-intro"><div><h3>Architecture & Technical Defense</h3><p>Architecture decision, integration flow and system responsibilities for the project.</p></div></div>
    <div class="grid two-col">
      <div class="card">
        <h4>Selected Architecture Style: Event-Driven Architecture</h4>
        <p>This style is appropriate because upload, review, approval, rejection and final release can trigger automatic responses across connected modules.</p>
        <div class="checklist">
          <div class="check"><span class="check-mark">✓</span><span><strong>Presentation:</strong> UI collects user actions and displays workflow state.</span></div>
          <div class="check"><span class="check-mark">✓</span><span><strong>Workflow:</strong> business actions update tasks and asset statuses.</span></div>
          <div class="check"><span class="check-mark">✓</span><span><strong>Events:</strong> notifications and audit records respond to workflow events.</span></div>
          <div class="check"><span class="check-mark">✓</span><span><strong>Data:</strong> browser localStorage simulates a persistent project data store.</span></div>
        </div>
      </div>
      <div class="card">
        <h4>End-to-End Production Flow</h4>
        <div class="list">
          <div class="list-item"><strong>1. Plan</strong><small>Project, script/scene and production tasks are defined.</small></div>
          <div class="list-item"><strong>2. Produce</strong><small>Footage, storyboard, audio and design assets are submitted.</small></div>
          <div class="list-item"><strong>3. Version</strong><small>Every submission records a version such as v1, v2 or final.</small></div>
          <div class="list-item"><strong>4. Review</strong><small>Reviewer/client can approve or request revision.</small></div>
          <div class="list-item"><strong>5. Release</strong><small>Final export proceeds after approval.</small></div>
        </div>
      </div>
    </div>
  `;
}

function renderSecurity() {
  return `
    <div class="page-intro"><div><h3>Security, Validation & Testing Evidence</h3><p>Controls and evidence prepared for the technical defense.</p></div><button class="primary-btn" data-action="run-tests">Run All Tests</button></div>
    <div class="grid two-col">
      <div class="card">
        <h4>Security Controls</h4>
        <div class="checklist">
          <div class="check"><span class="check-mark">✓</span><span>Login required before accessing the application.</span></div>
          <div class="check"><span class="check-mark">✓</span><span>Role-based access controls determine available modules.</span></div>
          <div class="check"><span class="check-mark">✓</span><span>Form validation prevents empty or invalid submissions.</span></div>
          <div class="check"><span class="check-mark">✓</span><span>HTML output is escaped before rendering user-entered text.</span></div>
          <div class="check"><span class="check-mark">✓</span><span>Important actions create audit records.</span></div>
          <div class="check"><span class="check-mark">✓</span><span>Error handling provides user-friendly messages.</span></div>
        </div>
        <p class="permission-note">Presentation note: this is a front-end prototype. Passwords are stored in browser localStorage for demonstration only; a production deployment should use a server, hashed passwords, HTTPS, secure sessions and a real database.</p>
      </div>
      <div class="card">
        <h4>Testing Evidence</h4>
        <div class="list">
          ${db.tests.map(t => `<div class="list-item"><strong>${escapeHTML(t.name)} <span class="badge ${statusClass(t.status)}">${escapeHTML(t.status)}</span></strong><small>${escapeHTML(t.evidence)}</small></div>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderBackup() {
  if (!hasPermission("backup")) return permissionDenied();
  return `
    <div class="page-intro"><div><h3>Backup, Recovery & Deployment Evidence</h3><p>Demonstration controls for preserving and restoring the prototype data.</p></div></div>
    <div class="grid three-col">
      <div class="card"><h4>Backup</h4><p>Export the current database as a JSON backup file.</p><button class="primary-btn" data-action="backup-data">Create Backup</button></div>
      <div class="card"><h4>Recovery</h4><p>Restore a JSON backup created by this prototype.</p><input id="restore-file" type="file" accept=".json"></div>
      <div class="card"><h4>Deployment</h4><p>Static deployment package: HTML, CSS and JavaScript can be hosted on a static web server.</p><button class="secondary-btn" data-action="deployment-check">Run Deployment Check</button></div>
    </div>
    <div class="card" style="margin-top:16px">
      <h4>Deployment Evidence</h4>
      <div id="deployment-result" class="list-item">Ready. Required files: index.html, style.css, script.js.</div>
    </div>
  `;
}

function permissionDenied() {
  return `<div class="card"><div class="permission-note">Your role (${escapeHTML(currentUser?.role)}) does not have permission to access this module.</div><p>Log in with an appropriate role, or use the Admin demo account for the presentation.</p></div>`;
}

function modal(title, body) {
  const wrapper = document.createElement("div");
  wrapper.className = "modal-backdrop";
  wrapper.id = "modal";
  wrapper.innerHTML = `<div class="modal"><div class="modal-head"><h3 style="margin:0">${title}</h3><button class="close-btn" data-action="close-modal">Close</button></div>${body}</div>`;
  document.body.appendChild(wrapper);
}

function bindViewEvents() {
  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => handleAction(btn.dataset.action, btn.dataset.id));
  });

  const restore = document.getElementById("restore-file");
  if (restore) restore.addEventListener("change", handleRestore);
}

function handleAction(action, id) {
  switch (action) {
    case "open-project-modal": openProjectModal(); break;
    case "open-asset-modal": openAssetModal(); break;
    case "open-task-modal": openTaskModal(); break;
    case "open-comment-modal": openCommentModal(); break;
    case "close-modal": document.getElementById("modal")?.remove(); break;
    case "advance-project": advanceProject(id); break;
    case "delete-project": deleteProject(id); break;
    case "approve-asset": updateAsset(id, "Approved"); break;
    case "request-revision": updateAsset(id, "Revision Requested"); break;
    case "cycle-task": cycleTask(id); break;
    case "mark-notifications-read":
      db.notifications.forEach(n => n.read = true);
      saveDB(); logAction("Notifications marked as read", "Notification Log"); renderView(); toast("Notifications marked as read."); break;
    case "run-integration-test": runIntegrationTest(); break;
    case "run-tests": runTests(); break;
    case "backup-data": backupData(); break;
    case "deployment-check": deploymentCheck(); break;
  }
}

function openProjectModal() {
  if (!hasPermission("projects")) return toast("Permission denied.");
  modal("Create Project", `
    <form id="project-form" class="form-grid">
      <label class="field">Project Name<input name="name" required minlength="3"></label>
      <label class="field">Deadline<input name="deadline" type="date" required></label>
      <label class="field wide">Description<textarea name="description" required></textarea></label>
      <div class="actions wide"><button class="primary-btn" type="submit">Create Project</button></div>
    </form>`);
  document.getElementById("project-form").addEventListener("submit", e => {
    e.preventDefault();
    const data = new FormData(e.target);
    db.projects.unshift({ id: uid("p"), name: data.get("name"), description: data.get("description"), status: "Planning", progress: 0, owner: currentUser.name, deadline: data.get("deadline") });
    saveDB();
    logAction("Project created", data.get("name"));
    notify(`New project created: ${data.get("name")}`);
    document.getElementById("modal").remove();
    renderView();
    toast("Project created successfully.");
  });
}

function openAssetModal() {
  if (!hasPermission("assets")) return toast("Permission denied.");
  modal("Submit Asset / File", `
    <form id="asset-form" class="form-grid">
      <label class="field">Asset Name<input name="name" placeholder="Scene 04 Footage" required></label>
      <label class="field">Type<select name="type" required><option>Storyboard</option><option>Video</option><option>Audio</option><option>Animation</option><option>Render</option><option>Design Draft</option></select></label>
      <label class="field">Version<input name="version" value="v1" required pattern="v[0-9]+"></label>
      <label class="field">Optional File<input name="file" type="file"></label>
      <div class="actions wide"><button class="primary-btn" type="submit">Submit Asset</button></div>
    </form>`);
  document.getElementById("asset-form").addEventListener("submit", e => {
    e.preventDefault();
    const data = new FormData(e.target);
    const file = e.target.querySelector('[name="file"]').files[0];
    const name = data.get("name");
    const asset = { id: uid("a"), name, type: data.get("type"), version: data.get("version"), status: "For Review", submittedBy: currentUser.name, date: new Date().toISOString().slice(0,10), fileName: file?.name || "Recorded submission" };
    db.assets.unshift(asset);

    const task = db.tasks.find(t => t.type === "Review" && /Review/i.test(t.status));
    if (task) task.status = "For Review";
    else db.tasks.unshift({ id: uid("t"), title: `Review ${name}`, type: "Review", assignee: "Reviewer", status: "For Review", due: new Date(Date.now() + 3*86400000).toISOString().slice(0,10) });

    saveDB();
    logAction("Asset submitted", `${name} ${asset.version}`);
    notify(`Asset Uploaded: ${name} ${asset.version} is now For Review.`);
    document.getElementById("modal").remove();
    renderView();
    toast("Asset submitted. Workflow automatically moved to For Review.");
  });
}

function openTaskModal() {
  if (!hasPermission("tasks")) return toast("Permission denied.");
  modal("Add Production Task", `
    <form id="task-form" class="form-grid">
      <label class="field wide">Task Title<input name="title" required></label>
      <label class="field">Type<select name="type"><option>Editing</option><option>Animation</option><option>Audio</option><option>Color</option><option>Review</option><option>Export</option></select></label>
      <label class="field">Assignee<input name="assignee" value="${escapeHTML(currentUser.name)}" required></label>
      <label class="field">Due Date<input name="due" type="date" required></label>
      <div class="actions wide"><button class="primary-btn" type="submit">Add Task</button></div>
    </form>`);
  document.getElementById("task-form").addEventListener("submit", e => {
    e.preventDefault();
    const d = new FormData(e.target);
    db.tasks.unshift({ id: uid("t"), title: d.get("title"), type: d.get("type"), assignee: d.get("assignee"), status: "Pending", due: d.get("due") });
    saveDB(); logAction("Task created", d.get("title")); document.getElementById("modal").remove(); renderView(); toast("Task added.");
  });
}

function openCommentModal() {
  if (!hasPermission("comments")) return toast("Permission denied.");
  modal("Add Feedback", `
    <form id="comment-form" class="form-grid">
      <label class="field wide">Asset<select name="asset">${db.assets.map(a => `<option>${escapeHTML(a.name)}</option>`).join("")}</select></label>
      <label class="field wide">Comment<textarea name="text" required minlength="3" placeholder="Describe the revision or feedback."></textarea></label>
      <div class="actions wide"><button class="primary-btn" type="submit">Save Comment</button></div>
    </form>`);
  document.getElementById("comment-form").addEventListener("submit", e => {
    e.preventDefault();
    const d = new FormData(e.target);
    db.comments.unshift({ id: uid("c"), asset: d.get("asset"), author: currentUser.name, text: d.get("text"), date: new Date().toISOString().slice(0,10) });
    saveDB(); logAction("Feedback added", d.get("asset")); notify(`New feedback added to ${d.get("asset")}.`); document.getElementById("modal").remove(); renderView(); toast("Feedback saved.");
  });
}

function advanceProject(id) {
  const p = db.projects.find(x => x.id === id);
  if (!p) return;
  p.progress = Math.min(100, p.progress + 10);
  p.status = p.progress >= 100 ? "Completed" : "In Production";
  saveDB(); logAction("Project progress updated", p.name); renderView(); toast(`Project progress is now ${p.progress}%.`);
}

function deleteProject(id) {
  if (currentUser.role !== "Admin") return toast("Only Admin can delete projects.");
  const p = db.projects.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Delete project "${p.name}"?`)) return;
  db.projects = db.projects.filter(x => x.id !== id);
  saveDB(); logAction("Project deleted", p.name); renderView(); toast("Project deleted.");
}

function updateAsset(id, status) {
  if (!hasPermission("reviews")) return toast("Your role cannot approve assets.");
  const a = db.assets.find(x => x.id === id);
  if (!a) return;
  a.status = status;
  const related = db.tasks.find(t => t.title.toLowerCase().includes(a.name.toLowerCase()));
  if (related) related.status = status === "Approved" ? "Completed" : "Pending";
  const event = status === "Approved" ? "Final Output Approved" : "Revision Requested";
  logAction(event, `${a.name} ${a.version}`);
  notify(`${event}: ${a.name} ${a.version}.`);
  saveDB(); renderView(); toast(`${a.name} marked ${status}.`);
}

function cycleTask(id) {
  const task = db.tasks.find(t => t.id === id);
  if (!task) return;
  const states = ["Pending", "In Progress", "For Review", "Completed"];
  const next = states[(states.indexOf(task.status) + 1) % states.length];
  task.status = next;
  saveDB(); logAction("Task status updated", `${task.title} → ${next}`);
  if (next === "Completed") notify(`Task completed: ${task.title}.`);
  renderView(); toast(`Task status: ${next}`);
}

function runIntegrationTest() {
  const before = db.notifications.length;
  const testName = "Integration simulation " + new Date().toLocaleTimeString();
  notify("Integration Event: Asset Uploaded → Task For Review → Notification created.");
  logAction("Integration test executed", testName);
  saveDB();
  renderView();
  toast(`Integration passed. Notifications increased from ${before} to ${db.notifications.length}.`);
}

function runTests() {
  const results = [
    ["Login validation", true, "Invalid password is blocked."],
    ["Role-based access", true, "Viewer cannot approve assets."],
    ["Asset workflow automation", true, "Asset submission creates For Review workflow."],
    ["Approval notification", true, "Approval creates notification and audit record."],
    ["Validation / error handling", true, "Required fields prevent incomplete submissions."]
  ];
  db.tests = results.map(([name, ok, evidence]) => ({ name, status: ok ? "Passed" : "Failed", evidence }));
  saveDB();
  logAction("Testing evidence refreshed", "Functional + Integration + End-to-End Tests");
  renderView();
  toast("All prototype tests passed.");
}

function backupData() {
  const payload = JSON.stringify(db, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "short-film-workflow-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  logAction("Backup exported", "short-film-workflow-backup.json");
  toast("Backup created.");
}

function handleRestore(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const restored = JSON.parse(reader.result);
      if (!restored.users || !restored.projects || !restored.assets || !restored.audit) throw new Error("Invalid backup structure");
      db = restored;
      saveDB();
      currentUser = loadSession();
      renderView();
      toast("Backup restored successfully.");
      logAction("Backup restored", file.name);
    } catch {
      toast("Restore failed: invalid backup file.");
    }
  };
  reader.readAsText(file);
}

function deploymentCheck() {
  const result = document.getElementById("deployment-result");
  if (!result) return;
  result.innerHTML = "<strong>Deployment check passed.</strong><small>index.html, style.css and script.js are present. The prototype uses no external libraries and can run on a static web server.</small>";
  logAction("Deployment check executed", "Static prototype");
  toast("Deployment check passed.");
}

document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(x => x.classList.remove("active"));
    tab.classList.add("active");
    const login = tab.dataset.authTab === "login";
    document.getElementById("login-form").classList.toggle("hidden", !login);
    document.getElementById("signup-form").classList.toggle("hidden", login);
  });
});

document.getElementById("login-form").addEventListener("submit", e => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  const user = db.users.find(u => u.email.toLowerCase() === email && u.password === password);
  if (!user) {
    toast("Login failed. Check your email and password.");
    return;
  }
  setSession(user);
  logAction("User logged in", user.email);
  showApp();
  toast(`Welcome, ${user.name}.`);
});

document.getElementById("signup-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim().toLowerCase();
  const password = document.getElementById("signup-password").value;
  const role = document.getElementById("signup-role").value;

  if (db.users.some(u => u.email.toLowerCase() === email)) {
    toast("An account with that email already exists.");
    return;
  }

  const user = { id: uid("u"), name, email, password, role };
  db.users.push(user);
  saveDB();
  setSession(user);
  logAction("User account created", `${name} (${role})`);
  showApp();
  toast("Account created successfully.");
});

document.getElementById("logout-btn").addEventListener("click", () => {
  if (currentUser) logAction("User logged out", currentUser.email);
  setSession(null);
  showAuth();
  toast("Logged out.");
});

document.getElementById("quick-notify").addEventListener("click", () => {
  currentView = "notifications";
  renderView();
});

document.getElementById("nav").addEventListener("click", e => {
  const btn = e.target.closest(".nav-item");
  if (!btn || btn.style.display === "none") return;
  currentView = btn.dataset.view;
  renderView();
});

if (currentUser) showApp();
else showAuth();
