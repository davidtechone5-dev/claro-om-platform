# Claro O&M Platform - Local Development Setup Guide (No-Docker Mode)

This guide explains how to run the Claro O&M frontend and backend services directly on your host machine (using `npm run dev`) while leveraging Docker solely for the PostgreSQL database container. 

This setup provides **fastest hot-reloading** and makes debugging in your local IDE extremely simple.

---

## 🛠️ Step 1: Start the Local PostgreSQL Database
We keep the database running inside a Docker container so you don't need to install PostgreSQL on your machine.

1. Make sure **Docker Desktop** is open and running in the background.
2. Open a terminal in the project root directory (`claro-om-platform`) and start **only** the database service:
   ```bash
   docker compose up db -d
   ```
   *This starts the PostgreSQL container on Port `5432` in the background.*

---

## 📝 Step 2: Configure Backend Environment Variables
Create or open the file `backend/.env` in your editor and configure it to point to your local PostgreSQL container:

```env
DATABASE_URL="postgresql://claro_user:claro_password@localhost:5432/claro_platform?schema=public"
DIRECT_URL="postgresql://claro_user:claro_password@localhost:5432/claro_platform?schema=public"
PORT=3000
JWT_SECRET="claro_super_secure_jwt_secret_key_2026"
JWT_EXPIRATION="24h"
INTEGRATION_SECRET="claro_integration_secret_token_12345"
GOOGLE_SPREADSHEET_ID="https://docs.google.com/spreadsheets/d/14ZCBnG-TBiS9wYrOe9zRkVJfdKt1vvVhZTZGUi842gw/edit?gid=755478552#gid=755478552"
```

---

## 🚀 Step 3: Initialize and Sync the Database
Since the local database container starts empty, you need to create the tables and import the live Google Sheet historical records.

1. Open a terminal in the `backend/` folder and run:
   ```bash
   # 1. Install packages
   npm install

   # 2. Push database schema to generate tables
   npx prisma db push

   # 3. Import all 640+ live records from the Google Sheet
   npm run db:import
   ```

---

## 💻 Step 4: Run the Backend & Frontend Servers

### 1. Start the Backend API
In your terminal inside the `backend/` directory, run:
```bash
npm run dev
```
*The backend API will start up and run at **`http://localhost:3000`**.*

### 2. Start the Frontend React Web App
1. Open a **new terminal window** in the `frontend/` directory.
2. Run:
   ```bash
   # Install packages
   npm install

   # Start local Vite server
   npm run dev
   ```
*The React app will start and provide a local browser link, usually **`http://localhost:5173/`**.*

---

## 🔑 Step 5: Open & Login to the App
1. Open **[http://localhost:5173](http://localhost:5173)** in your web browser.
2. Log in using the default system credentials:
   * **Email:** `admin@claro.com`
   * **Password:** `admin123`

You are now fully set up! All ticket assignments, metrics calculations, tabbed views, and dropdown updates will synchronize instantly.
