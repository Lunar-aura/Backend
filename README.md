# Task Management REST API

A REST API for managing **users, projects and tasks**, built with **Express.js** and **PostgreSQL**.
It supports register/login with JWT authentication, full CRUD, JOIN queries, search, filtering,
pagination, sorting, overdue tasks and a dashboard with task statistics.

**Author:** Kanza Nasir
**Course:** Web and Mobile App Development

---

## Features

- **Users, Projects and Tasks** tables with relationships (user → projects → tasks)
- **CRUD APIs** for users, projects and tasks
- **PostgreSQL JOIN queries** (tasks with project name and user name)
- **Search and filtering** on tasks (by title/description, status, project)
- **Pagination and sorting** (`page`, `limit`, `sort`, `order`)
- **Overdue tasks** endpoint
- **Dashboard** endpoint with total / completed / pending / overdue task counts
- **Validation and error handling** (proper status codes: 400, 401, 403, 404, 409, 500)
- **Basic authentication:** passwords hashed with bcrypt, login returns a JWT token
- Each user can only see and change **their own** projects and tasks

## Tech Stack

- Node.js, Express.js
- PostgreSQL (`pg`)
- `bcryptjs` (password hashing)
- `jsonwebtoken` (JWT authentication)
- `dotenv` (environment variables)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
npm install
```

### 2. Create the database tables

Create a PostgreSQL database, then run this SQL (for example in pgAdmin's Query Tool):

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  age INT,
  password TEXT
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id INT NOT NULL REFERENCES users(id)
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  project_id INT NOT NULL REFERENCES projects(id),
  user_id INT NOT NULL REFERENCES users(id),
  due_date DATE
);
```

If the `users` table already exists, just add the password column:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
```

**Relationships:** one user has many projects, and one project has many tasks.

### 3. Environment variables

Create a `.env` file in the project root (this file is not uploaded to GitHub):

```
JWT_SECRET=your_long_random_secret_key
```

Keep your database connection settings in `.env` / `db.js` as you normally do.

### 4. Start the server

```bash
node app.js
```

The API runs at **http://localhost:5000**.

---

## Authentication

1. Register with `POST /auth/register` or log in with `POST /auth/login`. Both return a `token`.
2. Send the token with **every other request** in the header:

```
Authorization: Bearer <your_token>
```

Requests without a valid token get `401 Unauthorized`.

---

## API Endpoints

### Auth (no token needed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create an account, returns user and token |
| POST | `/auth/login` | Log in, returns token |

### Users (token required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List all users (password is never returned) |
| GET | `/users/:id` | Get one user |
| PATCH | `/users/:id` | Update your own profile (send only the fields to change) |
| DELETE | `/users/:id` | Delete your own account (with your projects and tasks) |

### Projects (token required, only your own projects)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List your projects |
| GET | `/projects/:id` | Get one project |
| POST | `/projects` | Create a project |
| PATCH | `/projects/:id` | Update a project |
| DELETE | `/projects/:id` | Delete a project (and its tasks) |

### Tasks (token required, only your own tasks)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | List tasks with search, filters, pagination and sorting (JOIN with project and user) |
| GET | `/tasks/overdue` | Tasks past their due date that are not completed |
| GET | `/tasks/:id` | Get one task |
| POST | `/tasks` | Create a task |
| PATCH | `/tasks/:id` | Update a task (send only the fields to change) |
| DELETE | `/tasks/:id` | Delete a task |
| GET | `/tasks-with-users` | Tasks JOIN users |
| GET | `/tasks-details` | Tasks JOIN projects JOIN users |

### Dashboard (token required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Task statistics: total, completed, pending, overdue |

---

## Query Parameters for `GET /tasks`

| Parameter | Example | Description |
|-----------|---------|-------------|
| `search` | `search=api` | Matches title or description (case-insensitive) |
| `status` | `status=pending` | `pending` or `completed` |
| `project_id` | `project_id=1` | Only tasks of that project |
| `page` | `page=2` | Page number (default `1`) |
| `limit` | `limit=5` | Tasks per page (default `10`, max `100`) |
| `sort` | `sort=due_date` | `id` (default), `title`, `status` or `due_date` |
| `order` | `order=desc` | `asc` (default) or `desc` |

Example:

```
GET /tasks?search=api&status=pending&page=1&limit=5&sort=due_date&order=asc
```

---

## Request Examples

**Register** `POST /auth/register`

```json
{
  "name": "Kanza ",
  "email": "kanza@example.com",
  "password": "secret123",
  "age": 21
}
```

**Login** `POST /auth/login`

```json
{
  "email": "kanza@example.com",
  "password": "secret123"
}
```

**Create project** `POST /projects`

```json
{
  "name": "Website Redesign",
  "description": "Q4 website work"
}
```

**Create task** `POST /tasks`

```json
{
  "project_id": 1,
  "title": "Design database schema",
  "description": "Users, projects and tasks",
  "status": "pending",
  "due_date": "2026-10-20"
}
```

**Update task** `PATCH /tasks/1` (only the fields you want to change)

```json
{
  "status": "completed"
}
```

## Response Examples

**`GET /tasks`**

```json
{
  "page": 1,
  "limit": 10,
  "total": 1,
  "totalPages": 1,
  "data": [
    {
      "id": 1,
      "title": "Design database schema",
      "description": "Users, projects and tasks",
      "status": "pending",
      "due_date": "2026-10-20",
      "project_id": 1,
      "project_name": "Website Redesign",
      "user_name": "Kanza Nasir"
    }
  ]
}
```

**`GET /dashboard`**

```json
{
  "total": 5,
  "completed": 2,
  "pending": 3,
  "overdue": 1
}
```

`total = completed + pending`. `overdue` counts tasks past their due date that are not completed.

---

## Validation and Error Handling

| Status | Meaning | Example |
|--------|---------|---------|
| 400 | Bad request | Missing title, invalid status, invalid ID, invalid date |
| 401 | Unauthorized | Missing/invalid token, wrong email or password |
| 403 | Forbidden | Updating or deleting another user's profile |
| 404 | Not found | Task, project or user does not exist (or is not yours) |
| 409 | Conflict | Email already registered |
| 500 | Server error | Unexpected database error |

All errors return JSON in this format:

```json
{ "message": "Title and project_id are required" }
```

---

## Sample Data

The following sample records were used while testing the API.

### Users

| ID (PK) | Name | Email |
|---------|------|-------|
| 6 | Kanza  | kanza3@example.com |
| 7 | Zoya | kanza4@example.com |
| 8 | Fatima | fatima@example.com |

### Projects

| ID (PK) | Name | Description | User ID (FK) |
|---------|------|-------------|--------------|
| 3 | Project Alpha | null | 6 (Kanza ) |
| 4 | Project Beta | This is the official description for Project Beta | 7 (Zoya) |
| 5 | Gamma | This is the official description of Project Gamma in English. | 8 (Fatima) |

### Tasks

| ID (PK) | Title | Project ID (FK) | User ID (FK) |
|---------|-------|-----------------|--------------|
| 4 | Design Homepage V2 | 3 (Project Alpha) | 6 (Kanza ) |
| 5 | Setup Database | 4 (Project Beta) | 7 (Zoya) |
| 6 | Data Design | 5 (Gamma) | 8 (Fatima) |

**Relationships in the sample data:** each user owns one project, and each project contains one task
(Kanza Nasir → Project Alpha → Design Homepage V2, and so on).

Because every request is scoped to the logged-in user, each user only sees their own data.
For example, logging in as `kanza3@example.com` and calling `GET /tasks` returns only
*Design Homepage V2*, and `GET /dashboard` counts only that user's tasks.

---

## Testing with Postman

1. Import the included `postman_collection.json` into Postman.
2. Run **Register** (or **Login**) and copy the `token` from the response.
3. In the collection's **Authorization** tab, choose **Bearer Token** and paste the token.
4. Run the requests in this order: create project → create task → list tasks → search/filter → overdue → dashboard.

---

## Project Structure

```
.
├── app.js                      # All routes (auth, users, projects, tasks, dashboard)
├── db.js                       # PostgreSQL connection pool
├── package.json
├── .env                        # JWT_SECRET (not uploaded to GitHub)
├── .gitignore
├── postman_collection.json     # Postman collection
└── README.md
```
