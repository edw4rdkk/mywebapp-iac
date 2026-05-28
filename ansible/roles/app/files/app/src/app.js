// PR test - this should pass all checks
const express = require("express");
const { Pool } = require("pg");
const fs = require("fs");

function loadConfig() {
  const configPath = process.env.CONFIG_PATH || "/etc/mywebapp/config.json";
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(
      "Failed to load config from " + configPath + ":",
      err.message
    );
    process.exit(1);
  }
}

const config = loadConfig();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
});

function wantsJson(req) {
  const accept = req.headers["accept"] || "";
  return accept.includes("application/json");
}

function formatDate(d) {
  return new Date(d).toISOString().replace("T", " ").slice(0, 19);
}

app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html>
<head><title>Task Tracker</title></head>
<body>
  <h1>Task Tracker API</h1>
  <ul>
    <li><strong>GET</strong> <a href="/tasks">/tasks</a> — list all tasks</li>
    <li><strong>POST</strong> /tasks — create a new task (body: title)</li>
    <li><strong>POST</strong> /tasks/&lt;id&gt;/done — mark task as done</li>
  </ul>
</body>
</html>`);
});

app.get("/health/alive", (req, res) => {
  res.status(200).send("OK");
});

app.get("/health/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).send("OK");
  } catch (err) {
    res
      .status(500)
      .send("Not ready: database connection failed — " + err.message);
  }
});

app.get("/tasks", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, status, created_at FROM tasks ORDER BY id"
    );
    const tasks = result.rows;

    if (wantsJson(req)) {
      return res.json(tasks);
    }

    let rows = tasks
      .map(
        (t) =>
          "<tr>" +
          "<td>" +
          t.id +
          "</td>" +
          "<td>" +
          t.title +
          "</td>" +
          "<td>" +
          t.status +
          "</td>" +
          "<td>" +
          formatDate(t.created_at) +
          "</td>" +
          "</tr>"
      )
      .join("\n");

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html>
<head><title>Tasks</title></head>
<body>
  <h1>All Tasks</h1>
  <table border="1" cellpadding="6" cellspacing="0">
    <tr><th>ID</th><th>Title</th><th>Status</th><th>Created At</th></tr>
    ${rows}
  </table>
  <p><a href="/">Home</a></p>
</body>
</html>`);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

app.post("/tasks", async (req, res) => {
  const { title } = req.body;

  if (!title) {
    if (wantsJson(req)) {
      return res.status(400).json({ error: "title is required" });
    }
    return res.status(400).send("title is required");
  }

  try {
    const result = await pool.query(
      "INSERT INTO tasks (title, status, created_at) VALUES ($1, 'pending', NOW()) RETURNING id, title, status, created_at",
      [title]
    );
    const task = result.rows[0];

    if (wantsJson(req)) {
      return res.status(201).json(task);
    }

    res.setHeader("Content-Type", "text/html");
    res.status(201).send(`<!DOCTYPE html>
<html>
<head><title>Task Created</title></head>
<body>
  <h1>Task Created</h1>
  <p>ID: ${task.id}</p>
  <p>Title: ${task.title}</p>
  <p>Status: ${task.status}</p>
  <p>Created: ${formatDate(task.created_at)}</p>
  <p><a href="/tasks">All Tasks</a></p>
</body>
</html>`);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

app.post("/tasks/:id/done", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "UPDATE tasks SET status = 'done' WHERE id = $1 RETURNING id, title, status, created_at",
      [id]
    );

    if (result.rows.length === 0) {
      if (wantsJson(req)) {
        return res.status(404).json({ error: "Task not found" });
      }
      return res.status(404).send("Task not found");
    }

    const task = result.rows[0];

    if (wantsJson(req)) {
      return res.json(task);
    }

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html>
<head><title>Task Done</title></head>
<body>
  <h1>Task Marked as Done</h1>
  <p>ID: ${task.id}</p>
  <p>Title: ${task.title}</p>
  <p>Status: ${task.status}</p>
  <p>Created: ${formatDate(task.created_at)}</p>
  <p><a href="/tasks">All Tasks</a></p>
</body>
</html>`);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

const host = config.app.host || "127.0.0.1";
const port = config.app.port || 8000;

if (require.main === module) {
  app.listen(port, host, () => {
    console.log("Task Tracker listening on " + host + ":" + port);
  });
}

module.exports = app;
