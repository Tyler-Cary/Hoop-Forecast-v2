# 🌐 How to View the HoopForecast Website

## Prerequisites: Install Node.js

You need Node.js installed to run this app. Here's how:

### Option 1: Install via Homebrew (Recommended for macOS)

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node
```

### Option 2: Download from Node.js Website

1. Go to https://nodejs.org/
2. Download the **LTS (Long Term Support)** version for macOS
3. Run the installer
4. Restart your terminal

### Verify Installation

After installing, verify it works:

```bash
node --version
npm --version
```

You should see version numbers (e.g., `v18.17.0` and `9.6.7`)

---

## Step-by-Step: Running the Website

### Step 1: Install Backend Dependencies

Open Terminal and run:

```bash
cd /Applications/Project/backend
npm install
```

This will install all backend packages (Express, axios, ml-regression, etc.)

### Step 2: Install Frontend Dependencies

In the same terminal (or a new one):

```bash
cd /Applications/Project/frontend
npm install
```

This will install React, Vite, Tailwind, Recharts, etc.

### Step 3: Start the Backend Server

```bash
cd /Applications/Project/backend
npm run dev
```

You should see:
```
🏀 HoopForecast API server running on http://localhost:5000
```

**Keep this terminal window open!**

### Step 4: Start the Frontend Server

Open a **NEW terminal window** and run:

```bash
cd /Applications/Project/frontend
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### Step 5: Open in Browser

1. Open your web browser (Chrome, Firefox, Safari, etc.)
2. Go to: **http://localhost:3000**
3. You should see the HoopForecast homepage! 🎉

---

## Quick Start Script (After Node.js is Installed)

Once Node.js is installed, you can run both servers with these commands:

**Terminal 1 (Backend):**
```bash
cd /Applications/Project/backend && npm install && npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd /Applications/Project/frontend && npm install && npm run dev
```

---

## Troubleshooting

### "npm: command not found"
- Node.js is not installed. Follow the installation steps above.

### "Port 5000 already in use"
- Another app is using port 5000. Either:
  - Stop that app, or
  - Change the port in `backend/.env` to something else (e.g., `PORT=5001`)

### "Port 3000 already in use"
- Another app is using port 3000. Either:
  - Stop that app, or
  - Change the port in `frontend/vite.config.js`

### "Cannot GET /api/..."
- Make sure the backend server is running on port 5000
- Check that the frontend proxy is configured correctly in `vite.config.js`

### "Failed to fetch player stats"
- The balldontlie API might be down or rate-limited
- Check your internet connection
- Try again in a few minutes

---

## What You'll See

1. **Homepage**: Search bar to find NBA players
2. **Search Results**: List of matching players
3. **Player Detail Page**: 
   - Predicted points (from linear regression)
   - Betting line comparison
   - Interactive chart showing recent games
   - Color-coded recommendation (🟢 OVER / 🔴 UNDER)

---

## Stopping the Servers

To stop the servers:
- Press `Ctrl + C` in each terminal window
- Or close the terminal windows

---

## Need Help?

- Check `README.md` for full documentation
- Check `QUICKSTART.md` for setup details
- Make sure both servers are running before opening the browser!

