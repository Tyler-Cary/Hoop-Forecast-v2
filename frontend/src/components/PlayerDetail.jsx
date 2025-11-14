import { useState, useEffect } from 'react';
import axios from 'axios';
import PlayerCard from './PlayerCard';
import PredictionChart from './PredictionChart';
import ComparisonBox from './ComparisonBox';
import LoadingAnimation from './LoadingAnimation';

const API_BASE = '/api';

function PlayerDetail({ player, onBack }) {
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset loading state immediately when player changes
    setLoading(true);
    setError(null);
    setComparisonData(null);
    fetchComparisonData();
  }, [player.id]);

  const fetchComparisonData = async () => {
    setLoading(true);
    setError(null);

    try {
      const playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
      console.log(`Fetching comparison data for player: ${playerName}`);
      
      // Build query params with player name (required)
      const params = new URLSearchParams();
      params.append('name', playerName);
      
      // If we have betting line data from homepage, pass it to avoid API call
      if (player.betting_line != null) {
        params.append('betting_line', player.betting_line);
        if (player.bookmaker) {
          params.append('bookmaker', player.bookmaker);
        }
      }
      
      // Use any ID (doesn't matter since we use name)
      const url = `${API_BASE}/player/${player.id || '0'}/compare?${params.toString()}`;
      const response = await axios.get(url);
      console.log('Received comparison data:', response.data);
      
      // If we have betting line from homepage and API didn't return one, use it
      if (player.betting_line != null && !response.data.betting_line) {
        response.data.betting_line = player.betting_line;
        response.data.odds_bookmaker = player.bookmaker || null;
        // Recalculate recommendation if we have prediction
        if (response.data.prediction != null) {
          if (response.data.prediction > player.betting_line) {
            response.data.recommendation = 'OVER';
          } else if (response.data.prediction < player.betting_line) {
            response.data.recommendation = 'UNDER';
          } else {
            response.data.recommendation = 'PUSH';
          }
        }
      }
      
      setComparisonData(response.data);
    } catch (err) {
      console.error('Error fetching comparison data:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || err.message || 'Failed to load player data');
      // Set empty comparison data so UI doesn't break
      setComparisonData({
        player: `${player.first_name} ${player.last_name}`,
        stats: [],
        prediction: null,
        betting_line: null,
        recommendation: 'N/A'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="mb-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          ← Back
        </button>
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          <LoadingAnimation message="Loading player prediction..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="mb-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          ← Back
        </button>
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          <div className="text-red-400 text-center">
            <p className="text-xl font-semibold">Error</p>
            <p className="mt-2 text-gray-300">{error}</p>
            <button
              onClick={fetchComparisonData}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <button
        onClick={onBack}
        className="mb-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        ← Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Player Card and Comparison */}
        <div className="space-y-6">
          <PlayerCard 
            player={player} 
            comparisonData={comparisonData}
          />
          <ComparisonBox comparisonData={comparisonData} />
        </div>

        {/* Right Column: Chart */}
        <div>
          <PredictionChart 
            stats={comparisonData?.stats || []}
            prediction={comparisonData?.prediction}
          />
        </div>
      </div>
    </div>
  );
}

export default PlayerDetail;

