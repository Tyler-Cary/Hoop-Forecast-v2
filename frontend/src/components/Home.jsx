import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = '/api';

function Home({ onSelectPlayer }) {
  const [playersWithLines, setPlayersWithLines] = useState([]);
  const [loadingLines, setLoadingLines] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

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
    <div className="max-w-7xl mx-auto">
      {/* Search Toggle Button */}
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">
          Players with Betting Lines
        </h2>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          {showSearch ? 'Hide Search' : 'Search Player'}
        </button>
      </div>

      {/* Search Section */}
      {showSearch && (
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-8 border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4">
            Search for a Player
          </h3>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type player name (e.g., LeBron James, Stephen Curry)..."
              className="w-full px-4 py-3 text-lg bg-gray-700 text-white border-2 border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 placeholder-gray-400"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 text-red-300 rounded">
              {error}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-white mb-3">
                Search Results ({searchResults.length})
              </h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => handleSelectPlayer(player)}
                    className="p-4 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-white">
                          {player.first_name} {player.last_name}
                        </h4>
                        <p className="text-sm text-gray-300">
                          {player.position} • {player.team?.abbreviation || 'Free Agent'}
                        </p>
                      </div>
                      <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                        View Prediction →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchQuery && !isSearching && searchResults.length === 0 && (
            <div className="mt-6 text-center text-gray-400">
              No players found. Try a different search term.
            </div>
          )}
        </div>
      )}

      {/* Players with Lines Grid */}
      {loadingLines ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading players with betting lines...</p>
        </div>
      ) : playersWithLines.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {playersWithLines.map((player, index) => (
            <div
              key={`${player.name}-${index}`}
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
              className="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow cursor-pointer overflow-hidden border-2 border-gray-700 hover:border-purple-500"
            >
              {/* Player Image - Circular like PlayerCard */}
              <div className="flex justify-center pt-6 pb-2">
                {player.player_image ? (
                  <img 
                    src={player.player_image} 
                    alt={player.name}
                    className="w-32 h-32 rounded-full object-cover border-4 border-purple-200 shadow-lg"
                    onError={(e) => {
                      // Hide image and show initials if image fails to load
                      e.target.style.display = 'none';
                      const fallback = e.target.nextElementSibling;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`${player.player_image ? 'hidden' : 'flex'} w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 items-center justify-center border-4 border-purple-200 shadow-lg`}
                >
                  <span className="text-white text-4xl font-bold">
                    {player.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
              </div>

              {/* Player Info */}
              <div className="p-4">
                <h3 className="font-bold text-lg text-white mb-1 truncate">
                  {player.name}
                </h3>
                <p className="text-sm text-gray-300 mb-3">
                  {player.home_team} vs {player.away_team}
                </p>
                
                {/* Betting Line */}
                <div className="bg-purple-900/30 rounded-lg p-3 mb-3 border border-purple-700/50">
                  <div className="text-xs text-gray-400 mb-1">Betting Line</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {player.betting_line}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {player.bookmaker}
                  </div>
                </div>

                {/* View Button */}
                <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold">
                  View Prediction →
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 text-center border border-gray-700">
          <p className="text-gray-300 mb-4">
            No players with betting lines available at the moment.
          </p>
          <p className="text-sm text-gray-400">
            Use the search function above to find any player and see their prediction.
          </p>
        </div>
      )}
    </div>
  );
}

export default Home;
