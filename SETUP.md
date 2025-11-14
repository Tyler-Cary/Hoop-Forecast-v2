# 🚀 HoopForecast v2 - Setup Guide

This guide will help you set up HoopForecast v2 from scratch.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** v18 or higher installed ([Download](https://nodejs.org/))
- **npm** (comes with Node.js) or **yarn**
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))
- **The Odds API Key** ([Get one here](https://the-odds-api.com/))

## Step-by-Step Setup

### 1. Clone or Download the Repository

```bash
git clone <repository-url>
cd HoopForecast-v2
```

### 2. Backend Setup

#### Install Dependencies

```bash
cd backend
npm install
```

#### Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
touch .env
```

Add the following content to `.env`:

```env
# OpenAI API Key (REQUIRED for predictions)
OPENAI_API_KEY=sk-your-openai-api-key-here

# The Odds API Key (REQUIRED for betting lines)
ODDS_API_KEY=your-odds-api-key-here

# Server Port (optional, defaults to 5001)
PORT=5001
```

**Important**: Replace the placeholder values with your actual API keys.

#### Start the Backend Server

```bash
npm run dev
```

You should see:
```
🏀 HoopForecast API server running on http://localhost:5001
✅ Database initialized
✅ Cache service initialized
```

### 3. Frontend Setup

Open a **new terminal window** and navigate to the frontend directory:

```bash
cd frontend
npm install
```

#### Start the Frontend Development Server

```bash
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 4. Access the Application

Open your browser and navigate to the frontend URL (usually `http://localhost:5173`)

You should see the HoopForecast homepage with players who have betting lines!

## Verifying the Setup

### Test the Backend

1. Open `http://localhost:5001/api/health` in your browser
2. You should see: `{"status":"ok","message":"HoopForecast API is running"}`

### Test the Frontend

1. You should see the homepage with player cards
2. Click on any player card
3. You should see the loading animation, then the player's prediction page

## Troubleshooting

### Backend Issues

**Port Already in Use**
```bash
# Kill the process using port 5001
lsof -ti:5001 | xargs kill -9

# Or use a different port
PORT=5002 npm run dev
```

**API Key Errors**
- Verify your `.env` file is in the `backend` directory
- Check that API keys don't have extra spaces or quotes
- Ensure API keys are valid and have sufficient credits

**Module Not Found**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Frontend Issues

**Port Already in Use**
- Vite will automatically use the next available port
- Check the terminal output for the actual port number

**API Connection Errors**
- Ensure the backend is running on port 5001
- Check `frontend/vite.config.js` has the correct proxy configuration
- Verify CORS is enabled in the backend

**Build Errors**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Production Build

### Build Frontend

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`

### Run Production Backend

```bash
cd backend
npm start
```

## Next Steps

- Explore the homepage to see players with betting lines
- Search for your favorite players
- View predictions and compare them to betting lines
- Check out the interactive charts

## Need Help?

- Check the main [README.md](./README.md) for more details
- Review API endpoint documentation
- Check browser console and backend logs for errors

---

Happy predicting! 🏀⛈️

