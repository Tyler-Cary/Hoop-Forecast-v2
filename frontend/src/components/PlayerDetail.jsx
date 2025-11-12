import { useState, useEffect } from 'react';
import axios from 'axios';
import PlayerCard from './PlayerCard';
import PredictionChart from './PredictionChart';
import ComparisonBox from './ComparisonBox';

const API_BASE = '/api';

function PlayerDetail({ player, onBack }) {
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchComparisonData();
  }, [player.id]);

  const fetchComparisonData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log(`Fetching comparison data for player ID: ${player.id}`);
      const response = await axios.get(`${API_BASE}/player/${player.id}/compare`);
      console.log('Received comparison data:', response.data);
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
          className="mb-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          ← Back to Search
        </button>
        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading player data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="mb-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          ← Back to Search
        </button>
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-red-600 text-center">
            <p className="text-xl font-semibold">Error</p>
            <p className="mt-2">{error}</p>
            <button
              onClick={fetchComparisonData}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
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
        ← Back to Search
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

