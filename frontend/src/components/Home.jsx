import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = '/api';

function Home({ onSelectPlayer }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);

  // Debounced search - increased delay to reduce API calls
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    // Increase debounce time to reduce API calls and avoid rate limits
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 800); // Increased from 300ms to 800ms

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

  const handleSelectPlayer = (player) => {
    onSelectPlayer(player);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-xl p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Search for an NBA Player
        </h2>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type player name (e.g., LeBron James, Stephen Curry)..."
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
          />
          {isSearching && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">
              Search Results ({searchResults.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((player) => (
                <div
                  key={player.id}
                  onClick={() => handleSelectPlayer(player)}
                  className="p-4 bg-gray-50 hover:bg-purple-50 border border-gray-200 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-gray-800">
                        {player.first_name} {player.last_name}
                      </h4>
                      <p className="text-sm text-gray-600">
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
          <div className="mt-6 text-center text-gray-500">
            No players found. Try a different search term.
          </div>
        )}

        {!searchQuery && (
          <div className="mt-8 text-center text-gray-500">
            <p>Start typing a player's name to see predictions and betting comparisons.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;

