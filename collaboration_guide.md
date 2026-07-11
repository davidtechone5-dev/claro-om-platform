# Claro O&M Platform - Team Collaboration & Local Developer Guide (Docker)

This guide contains the absolute most basic, step-by-step instructions for running the Claro O&M Platform locally. It explains how to build the application, set up Git branches, run tests, and connect your local workspace either to a **local isolated database** or directly to your **live production Supabase database**.

---

## 1. Prerequisites (Do this first)

Make sure you have the following installed on your machine:
1.  **Git:** [Download & Install Git](https://git-scm.com/downloads) (or use [GitHub Desktop](https://desktop.github.com/)).
2.  **Docker Desktop:** [Download & Install Docker Desktop](https://www.docker.com/products/docker-desktop/) (ensure it is running in the background).

---

## 2. Git Collaboration & Branches Workflow

To keep the live website (`https://claro-om-platform.vercel.app`) safe, always work on feature branches.

### Step A: Clone the Repository (For new team members)
Open your terminal (Command Prompt, PowerShell, or Git Bash) and run:
```bash
git clone https://github.com/davidtechone5-dev/claro-om-platform.git
cd claro-om-platform
```

### Step B: Create a Feature Branch
Before writing any code, create a separate branch:
```bash
git checkout -b feature/your-task-name
```
*(Example: `git checkout -b feature/add-metrics`)*

### Step C: Commit and Push Changes
When your code changes are done and compiled without errors, push them:
```bash
git add .
git commit -m "feat: implement descriptive change summary"
git push origin feature/your-task-name
```
Then, open GitHub, select your branch, and click **`Create Pull Request`** to request a code review!

---

## 3. Option A: Run Locally using the LOCAL Database (Safe Sandbox)

This mode runs a completely local, isolated PostgreSQL database container. It is **100% safe** for local development because any changes you make will **not** affect the live production website database.

### Step 1: Spin Up the Stack
Open your terminal in the project root directory (`claro-om-platform`) and run:
```bash
docker compose up --build
```
*Wait 1–2 minutes for the containers to compile and start.*
*   **Web App Dashboard:** Open **`http://localhost`** in your browser.
*   **Backend API Service:** Live at `http://localhost:3000`.

### Step 2: Seed the Local Database (Mock Data)
Since the local PostgreSQL database container starts completely empty, run this command in a new terminal window to seed it with default mock users and master installations:
```bash
docker compose exec backend npx prisma db seed
```
*   **Default Admin Login:**
    *   **Email:** `admin@claro.com`
    *   **Password:** `admin123`

### Step 3: Stop the Stack
To stop the local environment, press **`Ctrl + C`** in your terminal, then run:
```bash
docker compose down
```

---

## 4. Option B: Run Locally using the LIVE Supabase Database (Real Data)

This mode connects your local development containers directly to your **live production Supabase database**. Any changes or assignments you test locally will immediately reflect on the live production website!

### Step 1: Get the Connection Strings
1.  Log in to your **Render Dashboard** (`dashboard.render.com`) ➡️ `claro-backend` ➡️ **`Environment`** tab.
2.  Copy your live **`DATABASE_URL`** and **`DIRECT_URL`** values.

### Step 2: Configure `docker-compose.yml`
Open [docker-compose.yml](file:///c:/claro/docker-compose.yml) in your code editor. Under the `backend:` service ➡️ `environment:` block, replace the local connection links with your live Supabase credentials:

```yaml
    environment:
      PORT: 3000
      # PASTE YOUR LIVE CONNECTION URLS BELOW:
      DATABASE_URL: "postgresql://postgres.[your-supabase-id]..."
      DIRECT_URL: "postgresql://postgres.[your-supabase-id]..."
      JWT_SECRET: claro_super_secure_jwt_secret_key_2026
      JWT_EXPIRATION: 24h
      INTEGRATION_SECRET: claro_integration_secret_token_12345
```

### Step 3: Run the Live Connected Environment
Open your terminal in the root folder and start the containers:
```bash
docker compose up --build
```
Your local website dashboard at **`http://localhost`** is now fetching and saving data directly to your **live Supabase database**! You will see all 640+ real tickets load instantly.

### Step 4: Revert Back to Local Sandbox (Important)
Once you are done debugging with live data, revert the connection strings in `docker-compose.yml` to the local configurations:
```yaml
      DATABASE_URL: postgresql://claro_user:claro_password@db:5432/claro_platform?schema=public
      DIRECT_URL: postgresql://claro_user:claro_password@db:5432/claro_platform?schema=public
```
This prevents you from accidentally modifying live database records during daily development tasks.
