# 🏀⛈️ HoopForecast v2

A modern, full-stack NBA player points prediction application that uses AI-powered predictions (ChatGPT) to forecast player performance and compares predictions against real-time sportsbook betting lines.

![HoopForecast v2](https://img.shields.io/badge/version-2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![React](https://img.shields.io/badge/React-18-blue)

## ✨ Features

### 🎯 Core Functionality
- **AI-Powered Predictions**: Uses OpenAI's ChatGPT to analyze player performance and generate accurate point predictions
- **Real-Time Betting Lines**: Fetches live betting lines from The Odds API for comparison
- **Player Search**: Search for any NBA player using ESPN API integration
- **Performance Charts**: Interactive bar charts showing recent game performance vs. predictions
- **Betting Recommendations**: Get OVER/UNDER recommendations based on AI predictions vs. betting lines

### 🏠 Homepage Features
- **Players with Lines**: Browse players who currently have betting lines available
- **Quick Access**: Click any player card to instantly view their prediction
- **Player Images**: Circular player headshots for visual identification
- **Matchup Info**: See upcoming games and opponents

### ⚡ Performance Optimizations
- **Smart Caching**: In-memory cache system for faster load times
  - Player stats cached for 24 hours
  - Predictions cached by game data hash
  - Betting lines cached for 1 hour
  - Homepage data cached for 30 minutes
- **Local Image Storage**: Player images stored locally for instant loading
- **Optimized API Calls**: Reduces API quota usage through intelligent caching

### 🎨 Modern UI/UX
- **Dark Theme**: Modern dark interface inspired by PrizePicks
- **Smooth Animations**: Loading animations and transitions
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Real-Time Updates**: Instant feedback when selecting players

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Axios** - HTTP client

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **OpenAI API** - ChatGPT for predictions
- **node-cache** - In-memory caching
- **Axios** - HTTP client

### APIs Used
- **ESPN API** - Player search and team schedules
- **NBA.com API** - Player stats and game logs
- **The Odds API** - Real-time betting lines
- **OpenAI API** - AI-powered predictions

## 📋 Prerequisites

- Node.js v18 or higher
- npm or yarn
- OpenAI API key (for predictions)
- The Odds API key (for betting lines)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd HoopForecast-v2
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
# OpenAI API Key (required for predictions)
OPENAI_API_KEY=your_openai_api_key_here

# The Odds API Key (required for betting lines)
ODDS_API_KEY=your_odds_api_key_here

# Server Port (optional, defaults to 5001)
PORT=5001
```

Start the backend server:

```bash
npm run dev
```

The backend will run on `http://localhost:5001`

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will run on `http://localhost:5173` (or the next available port)

### 4. Access the Application

Open your browser and navigate to the frontend URL (usually `http://localhost:5173`)

## 📁 Project Structure

```
HoopForecast-v2/
├── backend/
│   ├── routes/
│   │   ├── playerRoutes.js      # Player data endpoints
│   │   └── searchRoutes.js      # Player search endpoint
│   ├── services/
│   │   ├── databaseService.js    # Caching layer
│   │   ├── imageStorageService.js # Image management
│   │   ├── nbaApiService.js      # NBA.com & ESPN APIs
│   │   ├── oddsService.js        # The Odds API integration
│   │   ├── predictionService.js # ChatGPT predictions
│   │   └── teamLogoService.js    # Team logos/names
│   ├── public/
│   │   └── images/
│   │       └── players/          # Local player images
│   ├── data/
│   │   └── cache/                # Cache directory
│   ├── server.js                  # Express server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Home.jsx           # Homepage with player grid
│   │   │   ├── PlayerDetail.jsx   # Player prediction view
│   │   │   ├── PlayerCard.jsx     # Player info card
│   │   │   ├── PredictionChart.jsx # Performance chart
│   │   │   ├── ComparisonBox.jsx  # Prediction vs. line comparison
│   │   │   └── LoadingAnimation.jsx # Loading component
│   │   ├── App.jsx                # Main app component
│   │   ├── main.jsx               # Entry point
│   │   └── index.css              # Global styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

## 🔌 API Endpoints

### Player Endpoints

- `GET /api/player/with-lines` - Get list of players with current betting lines
- `GET /api/player/:id/compare?name=PlayerName` - Get full comparison (stats, prediction, odds)
- `GET /api/player/:id/stats?name=PlayerName` - Get player game stats
- `GET /api/player/:id/prediction?name=PlayerName` - Get AI prediction only
- `GET /api/player/:id/odds?name=PlayerName` - Get betting line only

### Search Endpoints

- `GET /api/search?q=playerName` - Search for players by name

### Health Check

- `GET /api/health` - Server health status

## 🧠 How It Works

### Prediction Flow

1. **Player Selection**: User searches or clicks a player from homepage
2. **Data Collection**: Backend fetches last 30 games (current + previous season) from NBA.com
3. **AI Analysis**: ChatGPT analyzes game history, trends, and patterns
4. **Prediction Generation**: AI generates prediction with confidence score and error margin
5. **Betting Line Fetch**: Backend retrieves current betting line from The Odds API
6. **Comparison**: App compares prediction vs. betting line and provides OVER/UNDER recommendation
7. **Visualization**: Charts display recent performance with prediction overlay

### Caching Strategy

- **Player Stats**: Cached for 24 hours (stats don't change frequently)
- **Predictions**: Cached by game data hash (same games = same prediction)
- **Betting Lines**: Cached for 1 hour (odds change frequently)
- **Homepage Data**: Cached for 30 minutes (refreshes regularly)
- **Next Games**: Cached for 6 hours (schedule changes infrequently)

## 🎨 UI Features

### Homepage
- Grid of players with betting lines
- Player images in circular format
- Matchup information (home/away teams)
- Betting line display
- Quick access to predictions

### Player Detail Page
- Player card with image and team info
- Interactive bar chart showing:
  - Recent game performance (green = over prediction, red = under)
  - Prediction line overlay
  - Game-by-game breakdown
- Comparison box showing:
  - AI prediction
  - Betting line
  - Recommendation (OVER/UNDER)
  - Confidence score
- Next game information

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
OPENAI_API_KEY=sk-...          # Required for predictions
ODDS_API_KEY=...               # Required for betting lines
PORT=5001                      # Optional, defaults to 5001
```

### API Keys

1. **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **The Odds API Key**: Get from [The Odds API](https://the-odds-api.com/)

## 📊 Performance

- **First Load**: ~2-3 seconds (fetches from APIs and caches)
- **Cached Load**: <100ms (served from cache)
- **Image Loading**: Instant (served from local storage)
- **Homepage**: <500ms (cached player list)

## 🐛 Troubleshooting

### Common Issues

**"No betting lines available"**
- Check your The Odds API key is valid
- Verify API quota hasn't been exceeded
- Some players may not have lines for upcoming games

**"Insufficient game data"**
- Player needs at least 3 games in current/previous season
- Rookie players or players with injuries may have limited data

**Images not loading**
- Images are downloaded on first access
- Check backend logs for download errors
- Fallback to NBA.com CDN if local download fails

**Slow load times**
- First load is slower (API calls)
- Subsequent loads use cache (much faster)
- Check network connection and API response times

## 🚧 Future Enhancements

- [ ] User accounts and favorite players
- [ ] Historical accuracy tracking
- [ ] Multiple prop types (assists, rebounds, etc.)
- [ ] Email/SMS notifications for favorite players
- [ ] Advanced filtering and sorting
- [ ] Dark/light theme toggle
- [ ] Mobile app version
- [ ] Social sharing of predictions

## 📝 License

ISC License

## ⚠️ Disclaimer

This application is for **entertainment purposes only**. Predictions are not guaranteed and should not be used as the sole basis for betting decisions. Always gamble responsibly and within your means.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Built with ❤️ for NBA fans and sports betting enthusiasts**
