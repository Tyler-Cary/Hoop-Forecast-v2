import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API_BASE = '/api';

function Home({ onSelectPlayer }) {
  const [playersWithLines, setPlayersWithLines] = useState([]);
  const [loadingLines, setLoadingLines] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [showSearch, setShowSearch] = useState(true); // Show search by default

  // Fetch players with betting lines on mount
  useEffect(() => {
    fetchPlayersWithLines();
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
    <div className="max-w-7xl mx-auto px-4">
      {/* Hero Section with Search */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3 bg-gradient-to-r from-yellow-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Prop Bet Analyzer
          </h1>
          <p className="text-gray-400 text-lg">
            AI-powered predictions for NBA player prop bets
          </p>
        </div>

        {/* Search Section - Always Visible */}
        <div className="bg-gray-800 rounded-xl shadow-2xl p-6 mb-8 border border-gray-700">
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for any NBA player..."
              className="w-full pl-12 pr-12 py-4 text-lg bg-gray-700 text-white border-2 border-gray-600 rounded-xl focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 placeholder-gray-400 transition-all"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500"></div>
              </div>
            )}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-red-900/30 border border-red-700 text-red-300 rounded-lg"
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
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-bold">
                  {searchResults.length}
                </span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {searchResults.map((player, index) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSelectPlayer(player)}
                    className="p-4 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg cursor-pointer transition-all hover:border-yellow-500 hover:shadow-lg"
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
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="ml-4 px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-400 transition-colors font-semibold"
                      >
                        View →
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

      {/* Players with Lines Section */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">
            Featured Players
          </h2>
          <p className="text-gray-400">
            Players with active betting lines
          </p>
        </div>
        {playersWithLines.length > 0 && (
          <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
            <span className="text-yellow-400 font-semibold">
              {playersWithLines.length} Available
            </span>
          </div>
        )}
      </div>

      {/* Players with Lines Grid */}
      {loadingLines ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-6 text-gray-300 text-lg">Loading players with betting lines...</p>
        </motion.div>
      ) : playersWithLines.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {playersWithLines.map((player, index) => (
            <motion.div
              key={`${player.name}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              whileHover={{ y: -5, scale: 1.02 }}
              onClick={() => {
                // Pass betting line data along with player name
                handleSelectPlayer({ 
                  name: player.name,
                  betting_line: player.betting_line,
                  bookmaker: player.bookmaker,
                  event_id: player.event_id,
                  home_team: player.home_team,
                  away_team: player.away_team
                });
              }}
              className="bg-gray-800 rounded-xl shadow-xl hover:shadow-2xl transition-all cursor-pointer overflow-hidden border-2 border-gray-700 hover:border-yellow-500 group"
            >
              {/* Player Image - Circular */}
              <div className="flex justify-center pt-6 pb-3 relative">
                {player.player_image ? (
                  <img 
                    src={player.player_image} 
                    alt={player.name}
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-600 group-hover:border-yellow-500 shadow-lg transition-all"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const fallback = e.target.nextElementSibling;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`${player.player_image ? 'hidden' : 'flex'} w-32 h-32 rounded-full bg-gradient-to-br from-yellow-500 via-purple-500 to-pink-500 items-center justify-center border-4 border-gray-600 group-hover:border-yellow-500 shadow-lg transition-all`}
                >
                  <span className="text-white text-4xl font-bold">
                    {player.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
              </div>

              {/* Player Info */}
              <div className="p-5">
                <h3 className="font-bold text-xl text-white mb-2 truncate group-hover:text-yellow-400 transition-colors">
                  {player.name}
                </h3>
                <p className="text-sm text-gray-400 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {player.home_team} vs {player.away_team}
                </p>
                
                {/* Betting Line */}
                <div className="bg-gradient-to-br from-yellow-500/10 to-purple-500/10 rounded-xl p-4 mb-4 border border-yellow-500/20">
                  <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Betting Line</div>
                  <div className="text-3xl font-bold text-yellow-400 mb-1">
                    {player.betting_line}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {player.bookmaker}
                  </div>
                </div>

                {/* View Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-gray-900 rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold shadow-lg hover:shadow-yellow-500/50"
                >
                  View Analysis →
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-xl shadow-xl p-12 text-center border border-gray-700"
        >
          <svg className="w-20 h-20 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
}

export default Home;
