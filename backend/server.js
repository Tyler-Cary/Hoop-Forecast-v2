import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { playerRoutes } from './routes/playerRoutes.js';
import { searchRoutes } from './routes/searchRoutes.js';
import { trendingRoutes } from './routes/trendingRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (player images and sportsbook logos)
app.use('/images', express.static(path.join(__dirname, 'public/images'), {
  setHeaders: (res, filePath) => {
    // Set correct content-type for SVG files (even if they have .png extension)
    if (filePath.endsWith('.png')) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.trim().startsWith('<svg')) {
          res.setHeader('Content-Type', 'image/svg+xml');
        }
      } catch (e) {
        // If we can't read it, let express handle it
      }
    }
  }
}));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HoopForecast API is running' });
});

// API routes
app.use('/api/player', playerRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/trending', trendingRoutes);

// Start server with error handling
app.listen(PORT, () => {
  console.log(`🏀 HoopForecast API server running on http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`💡 Try one of these solutions:`);
    console.error(`   1. Kill the process: lsof -ti:${PORT} | xargs kill -9`);
    console.error(`   2. Use a different port: PORT=5001 npm run dev`);
    console.error(`   3. Check what's using the port: lsof -i:${PORT}`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

