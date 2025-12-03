import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API_BASE = '/api';

// Helper function to get team logo URL
const getTeamLogo = (teamAbbrev) => {
  if (!teamAbbrev) return null;
  return `/images/team-logos/${teamAbbrev}.png`;
};

// Helper function to format prop type for display
const formatPropType = (propType) => {
  const labels = {
    'points': 'PTS',
    'rebounds': 'REB',
    'assists': 'AST',
    'threes': '3PT',
    'pra': 'PTS+REB+AST',
    'pr': 'PTS+REB',
    'pa': 'PTS+AST',
    'ra': 'REB+AST',
    'steals': 'STL',
    'blocks': 'BLK'
  };
  return labels[propType] || propType.toUpperCase();
};

function Home({ onSelectPlayer }) {
  const [playersWithLines, setPlayersWithLines] = useState([]);
  const [loadingLines, setLoadingLines] = useState(true);
  const [trendingProps, setTrendingProps] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [showSearch, setShowSearch] = useState(true); // Show search by default

  // Fetch players with betting lines and trending props on mount
  useEffect(() => {
    fetchPlayersWithLines();
    fetchTrendingProps();
  }, []);

  const fetchPlayersWithLines = async () => {
    setLoadingLines(true);
    try {
      const response = await axios.get(`${API_BASE}/player/with-lines`);
      setPlayersWithLines(response.data || []);
    } catch (err) {
      console.error('Error fetching players with lines:', err);
      setPlayersWithLines([]);
    } finally {
      setLoadingLines(false);
    }
  };

  const fetchTrendingProps = async () => {
    setLoadingTrending(true);
    try {
      const response = await axios.get(`${API_BASE}/trending/props`);
      setTrendingProps(response.data || []);
    } catch (err) {
      console.error('Error fetching trending props:', err);
      setTrendingProps([]);
    } finally {
      setLoadingTrending(false);
    }
  };

  // Debounced search - for players without lines
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const performSearch = async (query) => {
    setIsSearching(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE}/search`, {
        params: { q: query }
      });
      setSearchResults(response.data || []);
    } catch (err) {
      console.error('Search error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to search players. Please try again.';
      setError(errorMessage);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlayer = async (player) => {
    // If player has a name string, create player object immediately to show loading screen
    if (typeof player === 'string' || player.name) {
      const playerName = typeof player === 'string' ? player : player.name;
      const bettingLineData = {
        betting_line: player.betting_line,
        bookmaker: player.bookmaker,
        event_id: player.event_id,
        home_team: player.home_team,
        away_team: player.away_team
      };
      
      // Create player object immediately so loading screen shows right away
      const nameParts = playerName.split(' ');
      const immediatePlayer = {
        id: Math.random().toString(),
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        position: 'N/A',
        team: { abbreviation: 'N/A' },
        ...bettingLineData
      };
      
      // Set player immediately to show loading screen
      onSelectPlayer(immediatePlayer);
      
      // Then try to search for full player details in the background (non-blocking)
      try {
        const response = await axios.get(`${API_BASE}/search`, {
          params: { q: playerName }
        });
        
        if (response.data && response.data.length > 0) {
          // Update with full player details (PlayerDetail will handle this via useEffect)
          onSelectPlayer({
            ...response.data[0],
            ...bettingLineData
          });
        }
      } catch (err) {
        // Keep using the immediate player object if search fails
        console.log('Search failed, using basic player object:', err.message);
      }
    } else {
      onSelectPlayer(player);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section with Gradient Background */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative bg-gradient-to-b from-slate-900 via-slate-800 to-transparent pb-10 pt-8"
      >
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjAzIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          {/* Title Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 leading-tight">
              <span className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
            Prop Bet Analyzer
              </span>
          </h1>
            <p className="text-gray-300 text-base md:text-lg font-medium max-w-2xl mx-auto leading-relaxed">
            AI-powered predictions for NBA player prop bets
          </p>
          </motion.div>

          {/* Floating Search Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="max-w-3xl mx-auto"
          >
            <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-5 border border-white/5">
          <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for any NBA player..."
                  className="w-full pl-12 pr-12 py-3.5 text-base bg-slate-700/50 text-white border border-slate-600/50 rounded-xl focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 placeholder-gray-400 transition-all duration-200"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600 border-t-yellow-500"></div>
              </div>
            )}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl backdrop-blur-sm"
            >
              {error}
            </motion.div>
          )}

          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>Search Results</span>
                    <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-bold border border-yellow-500/30">
                  {searchResults.length}
                </span>
              </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {searchResults.map((player, index) => (
                  <motion.div
                    key={player.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                          delay: index * 0.02,
                          duration: 0.2,
                          ease: "easeOut"
                        }}
                        whileHover={{ 
                          y: -2,
                          scale: 1.01,
                          transition: { duration: 0.15 }
                        }}
                        whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectPlayer(player)}
                        className="p-4 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-xl cursor-pointer transition-all duration-200 hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/10 backdrop-blur-sm"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <h4 className="font-semibold text-white text-lg">
                          {player.first_name} {player.last_name}
                        </h4>
                        <p className="text-sm text-gray-300 mt-1">
                          {player.position} • {player.team?.abbreviation || 'Free Agent'}
                        </p>
                      </div>
                      <motion.button
                            whileHover={{ 
                              scale: 1.05,
                              transition: { duration: 0.1 }
                            }}
                        whileTap={{ scale: 0.95 }}
                            className="ml-4 px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-400 transition-colors font-semibold shadow-lg"
                      >
                            <span className="flex items-center gap-1">
                              View
                              <span>→</span>
                            </span>
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {searchQuery && !isSearching && searchResults.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 text-center text-gray-400 py-8"
            >
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No players found. Try a different search term.</p>
            </motion.div>
          )}
        </div>
      </motion.div>
        </div>
      </motion.div>

      {/* Divider */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="border-t border-white/5 mb-8"></div>
      </div>

      {/* Trending Props Section - Horizontal Scroll */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1 leading-tight flex items-center gap-2">
                <span>Trending Props Today</span>
                <img 
                  src="/fire.gif" 
                  alt="trending" 
                  className="w-6 h-6 fire-emoji select-none inline-block"
                  style={{ imageRendering: 'high-quality' }}
                />
              </h2>
              <p className="text-gray-400 text-sm font-medium">
                Props with the most sportsbook activity
              </p>
            </div>
            {trendingProps.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg backdrop-blur-sm"
              >
                <span className="text-amber-400 font-bold text-xs">
                  {trendingProps.length} Trending
                </span>
              </motion.div>
            )}
          </div>

          {/* Horizontal Scroll Container */}
          {loadingTrending ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center py-12"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="rounded-full h-12 w-12 border-4 border-slate-700 border-t-amber-500 mx-auto"
              />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-4 text-gray-300 text-sm font-medium"
              >
                Loading trending props...
              </motion.p>
            </motion.div>
          ) : trendingProps.length > 0 ? (
            <div className="overflow-x-auto overflow-y-visible snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent py-4">
              <div className="flex gap-4 px-1">
                {trendingProps.map((prop, index) => (
                  <motion.div
                    key={`${prop.player}-${prop.prop_type}-${prop.line}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ 
                      delay: index * 0.05, 
                      duration: 0.3,
                      ease: "easeOut"
                    }}
                    whileHover={{ 
                      y: -4,
                      transition: { duration: 0.2, ease: "easeOut" }
                    }}
                    whileTap={{ y: -2 }}
                    style={{ 
                      willChange: 'transform',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'translate3d(0,0,0)',
                      WebkitTransform: 'translate3d(0,0,0)',
                      WebkitFontSmoothing: 'antialiased'
                    }}
                    onClick={() => {
                      handleSelectPlayer({ 
                        name: prop.player,
                        betting_line: prop.line,
                        prop_type: prop.prop_type,
                        home_team: prop.home_team,
                        away_team: prop.away_team,
                        event_id: prop.event_id
                      });
                    }}
                    className="trending-card relative flex-shrink-0 w-72 snap-start rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-300 cursor-pointer border border-slate-700/50 hover:border-amber-500/50 group"
                  >
                    {/* Card Background - Clipped to rounded corners */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl -z-10 overflow-hidden"></div>
                    
                    {/* Rising Fire Embers Background */}
                    <div className="fire-background">
                      <div className="ember"></div>
                      <div className="ember"></div>
                      <div className="ember"></div>
                      <div className="ember"></div>
                      <div className="ember"></div>
                      <div className="ember"></div>
                      <div className="ember"></div>
                      <div className="ember"></div>
                    </div>

                    {/* Card Content - Above Embers */}
                    <div className="card-content relative z-10 p-4">
                      {/* Player Image & Name Header */}
                      <div className="flex items-center gap-3 mb-3">
                        {/* Player Image */}
                        {prop.player_image ? (
                          <div className="transform-none will-change-auto flex-shrink-0">
                            <img 
                              src={prop.player_image} 
                              alt={prop.player}
                              className="w-14 h-14 rounded-full object-cover ring-2 ring-amber-500/30 group-hover:ring-amber-500 select-none pointer-events-none"
                              style={{ 
                                imageRendering: 'high-quality',
                                WebkitBackfaceVisibility: 'hidden',
                                backfaceVisibility: 'hidden',
                                transform: 'translateZ(0)',
                                WebkitTransform: 'translateZ(0)'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div 
                            className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 flex items-center justify-center ring-2 ring-amber-500/30 group-hover:ring-amber-500 flex-shrink-0 transition-all duration-200"
                          >
                            <span className="text-white text-lg font-bold">
                              {prop.player.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                        )}
                        
                        {/* Player Name & Prop Type */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-white mb-1 group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                            <span className="truncate">{prop.player}</span>
                            <img 
                              src="/fire.gif" 
                              alt="trending" 
                              className="w-4 h-4 flex-shrink-0 fire-emoji select-none"
                              style={{ imageRendering: 'high-quality' }}
                            />
                          </h3>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-block px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold border border-amber-500/30">
                              {formatPropType(prop.prop_type)}
                            </span>
                            <span className="text-[10px] text-gray-500">•</span>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                              {getTeamLogo(prop.home_team) ? (
                                <img 
                                  src={getTeamLogo(prop.home_team)} 
                                  alt={prop.home_team}
                                  className="w-3 h-3 object-contain"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="font-medium">{prop.home_team}</span>
                              )}
                              <span className="text-gray-600">VS</span>
                              {getTeamLogo(prop.away_team) ? (
                                <img 
                                  src={getTeamLogo(prop.away_team)} 
                                  alt={prop.away_team}
                                  className="w-3 h-3 object-contain"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="font-medium">{prop.away_team}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Line */}
                      <div className="mb-2.5 bg-slate-700/30 rounded-lg p-2.5 border border-slate-600/30">
                        <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">Line</p>
                        <p className="text-xl font-extrabold text-amber-400 leading-tight">
                          O/U {prop.line}
                        </p>
                      </div>

                      {/* Book Count Badge */}
                      <div className="mb-2.5">
                        <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/5 rounded-lg p-2 border border-amber-500/20">
                          <div className="flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-gray-400 leading-none">Listed at</p>
                              <p className="text-xs font-bold text-amber-400 leading-tight">
                                {prop.bookCount} books
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Best Odds */}
                      {prop.bestOdds && (
                        <div className="bg-slate-700/20 rounded-lg p-2 border border-slate-600/20">
                          <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5 leading-none">Best Odds</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-white truncate mr-2">
                              {prop.bestOdds.sportsbook}
                            </span>
                            <span className={`text-sm font-bold ${prop.bestOdds.odds > 0 ? 'text-green-400' : 'text-white'}`}>
                              {prop.bestOdds.odds > 0 ? '+' : ''}{prop.bestOdds.odds}
                            </span>
                          </div>
                          <p className="text-[8px] text-gray-500 mt-0.5 capitalize leading-none">
                            {prop.bestOdds.type}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/40 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-slate-700/50"
            >
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <p className="text-gray-300 mb-2 text-lg font-semibold">
                No trending props available
              </p>
              <p className="text-sm text-gray-400">
                Check back soon for market activity
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Featured Players Section - Vertical Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 flex items-end justify-between"
        >
        <div>
            <h2 className="text-2xl font-bold text-white mb-1 leading-tight">
            Featured Players
          </h2>
            <p className="text-gray-400 text-sm font-medium">
            Players with active betting lines
          </p>
        </div>
        {playersWithLines.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg backdrop-blur-sm"
            >
              <span className="text-yellow-400 font-bold text-xs">
              {playersWithLines.length} Available
            </span>
            </motion.div>
        )}
        </motion.div>

      {/* Players with Lines Grid */}
      {loadingLines ? (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center py-20"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="rounded-full h-16 w-16 border-4 border-slate-700 border-t-yellow-500 mx-auto"
            />
            <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-6 text-gray-300 text-lg font-medium"
            >
              Loading players with betting lines...
            </motion.p>
            <div className="flex items-center justify-center space-x-2 mt-4">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-yellow-500 rounded-full"
                  animate={{
                    y: [0, -8, 0],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>
        </motion.div>
      ) : playersWithLines.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {playersWithLines.map((player, index) => (
            <motion.div
              key={`${player.name}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  delay: index * 0.05, 
                  duration: 0.3,
                  ease: "easeOut"
                }}
                whileHover={{ 
                  y: -4, 
                  scale: 1.01,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
              onClick={() => {
                handleSelectPlayer({ 
                  name: player.name,
                  betting_line: player.betting_line,
                  bookmaker: player.bookmaker,
                  event_id: player.event_id,
                  home_team: player.home_team,
                  away_team: player.away_team
                });
              }}
                className="bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-yellow-500/20 transition-all duration-300 cursor-pointer overflow-hidden border border-slate-700/50 hover:border-yellow-500/50 group"
            >
                {/* Player Image */}
                <div className="flex justify-center pt-5 pb-2.5">
                {player.player_image ? (
                  <img 
                    src={player.player_image} 
                    alt={player.name}
                      className="w-24 h-24 rounded-full object-cover ring-2 ring-yellow-500/30 group-hover:ring-yellow-500 shadow-xl transition-all duration-300"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const fallback = e.target.nextElementSibling;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                    className={`${player.player_image ? 'hidden' : 'flex'} w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500 via-amber-500 to-yellow-600 items-center justify-center ring-2 ring-yellow-500/30 group-hover:ring-yellow-500 shadow-xl transition-all duration-300`}
                >
                    <span className="text-white text-3xl font-bold">
                    {player.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
              </div>

              {/* Player Info */}
                <div className="px-4 pb-4">
                  <h3 className="font-bold text-base text-white mb-1 truncate group-hover:text-yellow-400 transition-colors">
                  {player.name}
                </h3>
                  <p className="text-xs text-gray-400 mb-3 flex items-center justify-center gap-2">
                    {getTeamLogo(player.home_team) ? (
                      <img 
                        src={getTeamLogo(player.home_team)} 
                        alt={player.home_team}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          // Fallback to text if logo fails to load
                          e.target.style.display = 'none';
                          const textSpan = document.createElement('span');
                          textSpan.className = 'font-medium';
                          textSpan.textContent = player.home_team;
                          e.target.parentNode.insertBefore(textSpan, e.target);
                        }}
                      />
                    ) : (
                      <span className="font-medium">{player.home_team}</span>
                    )}
                    <span className="text-gray-500 text-[10px]">VS</span>
                    {getTeamLogo(player.away_team) ? (
                      <img 
                        src={getTeamLogo(player.away_team)} 
                        alt={player.away_team}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          // Fallback to text if logo fails to load
                          e.target.style.display = 'none';
                          const textSpan = document.createElement('span');
                          textSpan.className = 'font-medium';
                          textSpan.textContent = player.away_team;
                          e.target.parentNode.insertBefore(textSpan, e.target);
                        }}
                      />
                    ) : (
                      <span className="font-medium">{player.away_team}</span>
                    )}
                </p>
                
                {/* Betting Line */}
                  <div className="bg-gradient-to-br from-yellow-500/10 to-transparent rounded-xl p-3 mb-3 border border-yellow-500/20">
                    <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">
                      {(() => {
                        const propLabels = {
                          points: 'PTS',
                          assists: 'AST',
                          rebounds: 'REB',
                          threes: '3PT',
                          steals: 'STL',
                          blocks: 'BLK',
                          pra: 'PTS + AST + REB',
                          pr: 'PTS + REB',
                          pa: 'PTS + AST',
                          ra: 'REB + AST',
                          points_rebounds: 'PTS + REB',
                          points_assists: 'PTS + AST',
                          rebounds_assists: 'REB + AST',
                          points_rebounds_assists: 'PTS + AST + REB'
                        };
                        return propLabels[player.prop_type] || player.prop_type?.toUpperCase() || 'PTS';
                      })()}
                    </div>
                    <div className="text-3xl font-extrabold text-yellow-400 mb-1">
                    {player.betting_line}
                  </div>
                    <div className="text-xs text-gray-400">{player.bookmaker}</div>
                  </div>

                  {/* View Button */}
                  <button className="w-full px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-900 rounded-xl hover:from-yellow-400 hover:to-amber-400 transition-all font-bold shadow-lg">
                    View Analysis
                  </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/40 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-slate-700/50"
        >
            <svg className="w-20 h-20 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-300 mb-2 text-lg font-semibold">
            No players with betting lines available
          </p>
          <p className="text-sm text-gray-400">
            Use the search above to find any player and see their prediction
          </p>
        </motion.div>
      )}
      </div>
    </div>
  );
}

export default Home;
