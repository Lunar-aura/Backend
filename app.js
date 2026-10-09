import "dotenv/config";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import pool from "./db.js";

// DATE ko 'YYYY-MM-DD' text ki tarah lo (warna timezone ki wajah se date badal sakti hai)
pg.types.setTypeParser(1082, (value) => value);

const app = express();

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey";


// ==================== PUBLIC ROUTES ====================

app.get("/", (req, res) => {
    res.send("Hello Backend!");
});

app.get("/about", (req, res) => {
    res.send("About Page");
});

app.get("/contact", (req, res) => {
    res.send("Contact Page");
});


// ==================== AUTH (Register / Login) ====================

// POST - Register
app.post("/auth/register", async (req, res) => {

    const { name, email, password, age } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            message: "Name, email and password are required"
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            message: "Password must be at least 6 characters"
        });
    }

    try {

        // email pehle se to nahi?
        const emailCheck = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (emailCheck.rows.length > 0) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        // password ko hash karo (seedha save nahi karte)
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, age, password)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, age`,
            [name, email, age, hashedPassword]
        );

        const user = result.rows[0];
          // purane user jinka password save nahi hai
        if (!user.password) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // token banao
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "1d" });

        res.status(201).json({
            message: "User registered successfully",
            user: user,
            token: token
        });

    } catch (error) {

        console.log("Register Error:", error);

        res.status(500).json({
            message: "Registration failed"
        });
    }

});


// POST - Login
app.post("/auth/login", async (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    try {

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        // password match karo
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "1d" });

        res.json({
            message: "Login successful",
            token: token
        });

    } catch (error) {

        console.log("Login Error:", error);

        res.status(500).json({
            message: "Login failed"
        });
    }

});


// ==================== AUTH MIDDLEWARE ====================
// Is line ke neeche jitne routes hain un sab ke liye token zaroori hai.
// Token Postman mein is tarah bhejte hain:  Authorization: Bearer <token>

app.use((req, res, next) => {

    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({
            message: "Token required"
        });
    }

    const token = header.split(" ")[1];

    try {

        const decoded = jwt.verify(token, JWT_SECRET);

        req.userId = decoded.id;   // logged-in user ki id

        next();

    } catch (error) {

        res.status(401).json({
            message: "Invalid or expired token"
        });
    }

});


// ==================== USERS ====================

// GET - All Users
app.get("/users", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT id, name, email, age FROM users ORDER BY id"
        );

        res.json(result.rows);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Failed to fetch users"
        });
    }

});


// GET - Single User
app.get("/users/:id", async (req, res) => {

    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({
            message: "Invalid user ID"
        });
    }

    try {

        const result = await pool.query(
            "SELECT id, name, email, age FROM users WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Failed to fetch user"
        });
    }

});


// PATCH - Update User (sirf apna profile)
app.patch("/users/:id", async (req, res) => {

    const { id } = req.params;
    const { name, email, age } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({
            message: "Invalid user ID"
        });
    }

    if (Number(id) !== req.userId) {
        return res.status(403).json({
            message: "You can only update your own profile"
        });
    }

    try {

        // COALESCE: agar naya value nahi aya to purana value rehne do
        const result = await pool.query(
            `UPDATE users
             SET name = COALESCE($1, name),
                 email = COALESCE($2, email),
                 age = COALESCE($3, age)
             WHERE id = $4
             RETURNING id, name, email, age`,
            [name, email, age, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: "User updated successfully",
            user: result.rows[0]
        });

    } catch (error) {

        console.log("UPDATE ERROR:", error);

        res.status(500).json({
            message: "Failed to update user"
        });
    }

});


// DELETE - Delete User (sirf apna account)
app.delete("/users/:id", async (req, res) => {

    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({
            message: "Invalid user ID"
        });
    }

    if (Number(id) !== req.userId) {
        return res.status(403).json({
            message: "You can only delete your own account"
        });
    }

    try {

        // pehle is user ke tasks, phir projects, phir user delete karo
        await pool.query("DELETE FROM tasks WHERE user_id = $1", [id]);
        await pool.query("DELETE FROM projects WHERE user_id = $1", [id]);

        const result = await pool.query(
            "DELETE FROM users WHERE id = $1 RETURNING id, name, email, age",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: "User deleted successfully",
            user: result.rows[0]
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Failed to delete user"
        });
    }

});


// ==================== PROJECTS ====================

// GET - All Projects (sirf logged-in user ke)
app.get("/projects", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT * FROM projects WHERE user_id = $1 ORDER BY id",
            [req.userId]
        );

        res.json(result.rows);

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to get projects"
        });
    }

});


// GET - Single Project
app.get("/projects/:id", async (req, res) => {

    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({
            message: "Invalid project ID"
        });
    }

    try {

        const result = await pool.query(
            "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to get project"
        });
    }

});


// POST - Add Project
app.post("/projects", async (req, res) => {

    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({
            message: "Name is required"
        });
    }

    try {

        // user_id token se aata hai, body mein bhejne ki zaroorat nahi
        const result = await pool.query(
            `INSERT INTO projects (name, description, user_id)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [name, description, req.userId]
        );

        res.status(201).json({
            message: "Project added successfully",
            project: result.rows[0]
        });

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to add project"
        });
    }

});


// PATCH - Update Project
app.patch("/projects/:id", async (req, res) => {

    const { id } = req.params;
    const { name, description } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({
            message: "Invalid project ID"
        });
    }

    try {

        const result = await pool.query(
            `UPDATE projects
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description)
             WHERE id = $3 AND user_id = $4
             RETURNING *`,
            [name, description, id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        res.json({
            message: "Project updated successfully",
            project: result.rows[0]
        });

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to update project"
        });
    }

});


// DELETE - Delete Project
app.delete("/projects/:id", async (req, res) => {

    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({
            message: "Invalid project ID"
        });
    }

    try {

        // pehle check karo project is user ka hai
        const check = await pool.query(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
            [id, req.userId]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        // pehle us project ke tasks delete karo, phir project
        await pool.query("DELETE FROM tasks WHERE project_id = $1", [id]);

        const result = await pool.query(
            "DELETE FROM projects WHERE id = $1 RETURNING *",
            [id]
        );

        res.json({
            message: "Project deleted successfully",
            project: result.rows[0]
        });

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to delete project"
        });
    }

});


// ==================== TASKS ====================

// GET - All Tasks (JOIN + search + filter + pagination + sorting)
// Example: /tasks?search=api&status=pending&project_id=1&page=1&limit=5&sort=due_date&order=desc
app.get("/tasks", async (req, res) => {

    const status = req.query.status || null;
    const project_id = req.query.project_id || null;
    const search = req.query.search ? "%" + req.query.search + "%" : null;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    let sort = req.query.sort || "id";
    let order = req.query.order === "desc" ? "DESC" : "ASC";

    // sirf in columns par sort allowed hai (security ke liye)
    const allowedSort = ["id", "title", "status", "due_date"];

    if (!allowedSort.includes(sort)) {
        return res.status(400).json({
            message: "sort must be one of: id, title, status, due_date"
        });
    }

    if (status && !["pending", "completed"].includes(status)) {
        return res.status(400).json({
            message: "Status must be pending or completed"
        });
    }

    if (project_id && isNaN(project_id)) {
        return res.status(400).json({
            message: "project_id must be a number"
        });
    }

    if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({
            message: "page must be 1 or more and limit must be between 1 and 100"
        });
    }

    const offset = (page - 1) * limit;

    // Har filter optional hai: agar value null hai to wo condition ignore ho jati hai
    const filters = `
        WHERE tasks.user_id = $1
        AND ($2::text IS NULL OR tasks.title ILIKE $2 OR tasks.description ILIKE $2)
        AND ($3::text IS NULL OR tasks.status = $3)
        AND ($4::int IS NULL OR tasks.project_id = $4)
    `;

    const values = [req.userId, search, status, project_id];

    try {

        // total tasks (pagination ke liye)
        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total FROM tasks ${filters}`,
            values
        );

        const total = countResult.rows[0].total;

        const result = await pool.query(
            `SELECT
                tasks.id,
                tasks.title,
                tasks.description,
                tasks.status,
                tasks.due_date,
                tasks.project_id,
                projects.name AS project_name,
                users.name AS user_name
             FROM tasks
             JOIN projects ON tasks.project_id = projects.id
             JOIN users ON tasks.user_id = users.id
             ${filters}
             ORDER BY tasks.${sort} ${order} NULLS LAST, tasks.id
             LIMIT ${limit} OFFSET ${offset}`,
            values
        );

        res.json({
            page: page,
            limit: limit,
            total: total,
            totalPages: Math.ceil(total / limit),
            data: result.rows
        });

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to get tasks"
        });
    }

});


// GET - Overdue Tasks (due date nikal chuki aur completed nahi)
// Ye /tasks/:id se PEHLE hona chahiye
app.get("/tasks/overdue", async (req, res) => {

    try {

        const result = await pool.query(
            `SELECT
                tasks.id,
                tasks.title,
                tasks.status,
                tasks.due_date,
                projects.name AS project_name
             FROM tasks
             JOIN projects ON tasks.project_id = projects.id
             WHERE tasks.user_id = $1
             AND tasks.due_date < CURRENT_DATE
             AND tasks.status <> 'completed'
             ORDER BY tasks.due_date`,
            [req.userId]
        );

        res.json(result.rows);

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to get overdue tasks"
        });
    }

});


// GET - Single Task
app.get("/tasks/:id", async (req, res) => {

    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({
            message: "Invalid task ID"
        });
    }

    try {

        const result = await pool.query(
            "SELECT * FROM tasks WHERE id = $1 AND user_id = $2",
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to get task"
        });
    }

});


// POST - Add Task
app.post("/tasks", async (req, res) => {

    const { title, description, status, project_id, due_date } = req.body;

    if (!title || !project_id) {
        return res.status(400).json({
            message: "Title and project_id are required"
        });
    }

    if (status && !["pending", "completed"].includes(status)) {
        return res.status(400).json({
            message: "Status must be pending or completed"
        });
    }

    if (due_date && isNaN(Date.parse(due_date))) {
        return res.status(400).json({
            message: "due_date must be a valid date like 2026-10-20"
        });
    }

    try {

        // project is user ka hona chahiye
        const projectCheck = await pool.query(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
            [project_id, req.userId]
        );

        if (projectCheck.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const result = await pool.query(
            `INSERT INTO tasks
             (title, description, status, project_id, user_id, due_date)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                title,
                description,
                status || "pending",
                project_id,
                req.userId,
                due_date
            ]
        );

        res.status(201).json({
            message: "Task added successfully",
            task: result.rows[0]
        });

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to add task"
        });
    }

});


// PATCH - Update Task (jo field bhejo wahi update hogi)
app.patch("/tasks/:id", async (req, res) => {

    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({
            message: "Invalid task ID"
        });
    }

    const { title, description, status, project_id, due_date } = req.body;

    if (status && !["pending", "completed"].includes(status)) {
        return res.status(400).json({
            message: "Status must be pending or completed"
        });
    }

    if (due_date && isNaN(Date.parse(due_date))) {
        return res.status(400).json({
            message: "due_date must be a valid date like 2026-10-20"
        });
    }

    try {

        // agar project_id badal rahe ho to wo project bhi apna hona chahiye
        if (project_id) {

            const projectCheck = await pool.query(
                "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
                [project_id, req.userId]
            );

            if (projectCheck.rows.length === 0) {
                return res.status(404).json({
                    message: "Project not found"
                });
            }
        }

        const result = await pool.query(
            `UPDATE tasks
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 status = COALESCE($3, status),
                 project_id = COALESCE($4, project_id),
                 due_date = COALESCE($5, due_date)
             WHERE id = $6 AND user_id = $7
             RETURNING *`,
            [title, description, status, project_id, due_date, id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        res.json({
            message: "Task updated successfully",
            task: result.rows[0]
        });

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to update task"
        });
    }

});


// DELETE - Delete Task
app.delete("/tasks/:id", async (req, res) => {

    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({
            message: "Invalid task ID"
        });
    }

    try {

        const result = await pool.query(
            "DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *",
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        res.json({
            message: "Task deleted successfully",
            task: result.rows[0]
        });

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to delete task"
        });
    }

});


// ==================== JOIN ROUTES ====================

// Tasks + Users (JOIN)
app.get("/tasks-with-users", async (req, res) => {

    try {

        const result = await pool.query(
            `SELECT
                tasks.id,
                tasks.title,
                tasks.status,
                users.name AS user_name
             FROM tasks
             JOIN users
             ON tasks.user_id = users.id
             WHERE tasks.user_id = $1
             ORDER BY tasks.id`,
            [req.userId]
        );

        res.json(result.rows);

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to get tasks with users"
        });
    }

});


// Tasks + Projects + Users (double JOIN)
app.get("/tasks-details", async (req, res) => {

    try {

        const result = await pool.query(
            `SELECT
                tasks.id,
                tasks.title,
                tasks.status,
                projects.name AS project_name,
                users.name AS user_name
             FROM tasks
             JOIN projects
             ON tasks.project_id = projects.id
             JOIN users
             ON tasks.user_id = users.id
             WHERE tasks.user_id = $1
             ORDER BY tasks.id`,
            [req.userId]
        );

        res.json(result.rows);

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to get task details"
        });
    }

});


// ==================== DASHBOARD ====================

// GET - Task statistics
app.get("/dashboard", async (req, res) => {

    try {

        const result = await pool.query(
            `SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status <> 'completed')::int AS overdue
             FROM tasks
             WHERE user_id = $1`,
            [req.userId]
        );

        res.json(result.rows[0]);

    } catch (error) {

        console.log("Database Failed", error);

        res.status(500).json({
            message: "Failed to get dashboard"
        });
    }

});


// ==================== PROJECTS UPDATE ROUTE ====================
// PUT - Update Project Description
app.put("/projects/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
    }

    try {
        const result = await pool.query(
            `UPDATE projects 
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description) 
             WHERE id = $3 AND user_id = $4
             RETURNING *`,
            [name, description, id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                message: "Project not found or you are not authorized" 
            });
        }

        res.json({
            message: "Project updated successfully",
            project: result.rows[0]
        });

    } catch (error) {
        console.log("Project Update Error:", error);
        res.status(500).json({ message: "Failed to update project" });
    }
});

// ==================== SERVER ====================

app.listen(5000, () => {
    console.log("Server is running on port 5000");
});