# Changelog

All notable changes to HoopForecast will be documented in this file.

## [2.0.0] - 2025-11-14

### 🎉 Major Release - HoopForecast v2

### Added
- **AI-Powered Predictions**: Integrated OpenAI ChatGPT for intelligent point predictions
- **Smart Caching System**: In-memory cache using node-cache for faster load times
  - Player stats cached for 24 hours
  - Predictions cached by game data hash
  - Betting lines cached for 1 hour
  - Homepage data cached for 30 minutes
- **Local Image Storage**: Player images downloaded and stored locally for instant loading
- **Homepage with Betting Lines**: Browse players who currently have betting lines available
- **Modern Dark Theme**: PrizePicks-inspired dark UI design
- **Loading Animations**: Smooth loading states with animated dots
- **Enhanced Player Search**: ESPN API integration for reliable player search
- **Previous Season Data**: Predictions now use current + previous season data (30 games total)
- **Image Metadata Caching**: Fast image URL lookups with 7-day cache

### Changed
- **Prediction Engine**: Switched from linear regression to ChatGPT AI predictions
- **API Integration**: 
  - Removed balldontlie API dependency
  - Now uses NBA.com API directly for stats
  - ESPN API for player search and schedules
  - The Odds API for betting lines
- **UI/UX Improvements**:
  - Modern dark theme throughout
  - Circular player images
  - Improved chart styling (bar charts with color coding)
  - Better loading states
- **Performance**: 
  - Significantly faster load times with caching
  - Reduced API calls through intelligent caching
  - Instant image loading from local storage

### Removed
- **Unused Services**: 
  - Removed balldontlieService.js
  - Removed espnService.js (functionality moved to nbaApiService)
  - Removed draftkingsService.js
- **Unnecessary Fallbacks**: Removed complex retry logic and fallback mechanisms
- **Old UI Elements**: Removed outdated styling and components

### Fixed
- **Loading Delay**: Loading screen now appears immediately when clicking players
- **Image Loading**: Fixed 403/timeout errors with local image storage
- **Betting Line Display**: Fixed issue where betting lines from homepage weren't showing in detail view
- **API Quota Issues**: Implemented caching to reduce API quota usage

### Technical Improvements
- **Code Cleanup**: Removed unused code and services
- **Error Handling**: Improved error messages and handling
- **Logging**: Better console logging for debugging
- **Dependencies**: Updated and optimized package dependencies

## [1.0.0] - Previous Version

### Features
- Basic linear regression predictions
- balldontlie API integration
- Simple UI with line charts
- Basic player search

---

**Note**: This is a complete rewrite with significant improvements in prediction accuracy, performance, and user experience.

