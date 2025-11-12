function PlayerCard({ player, comparisonData }) {
  const playerName = `${player.first_name} ${player.last_name}`;
  const displayName = comparisonData?.player || playerName;

  return (
    <div className="bg-white rounded-lg shadow-xl p-6">
      <div className="text-center">
        {comparisonData?.player_image && (
          <div className="mb-4 flex justify-center">
            <img 
              src={comparisonData.player_image} 
              alt={displayName}
              className="w-32 h-32 rounded-full object-cover border-4 border-purple-200 shadow-lg"
              onError={(e) => {
                // Hide image if it fails to load
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}
        <h2 className="text-3xl font-bold text-gray-800 mb-2">{displayName}</h2>
        <p className="text-gray-600 mb-4">
          {player.position} • {player.team?.abbreviation || 'Free Agent'}
        </p>

        {comparisonData && (
          <div className="mt-6 space-y-4">
            {/* Next Game Info */}
            {comparisonData.next_game && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-200">
                <p className="text-sm font-semibold text-gray-700 mb-1">Next Game</p>
                <p className="text-lg font-bold text-gray-800">
                  vs {comparisonData.next_game.opponent || 'TBD'}
                  {comparisonData.next_game.date && comparisonData.next_game.date !== 'TBD' && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      ({comparisonData.next_game.date})
                    </span>
                  )}
                </p>
                {comparisonData.prediction != null && (
                  <p className="text-sm text-gray-600 mt-1">
                    Predicted: <span className="font-bold text-purple-700">{comparisonData.prediction.toFixed(1)} pts</span>
                  </p>
                )}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Predicted Points</p>
                <p className="text-2xl font-bold text-purple-700">
                  {comparisonData.prediction != null ? comparisonData.prediction.toFixed(1) : 'N/A'}
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Betting Line</p>
                <p className="text-2xl font-bold text-blue-700">
                  {comparisonData.betting_line != null ? comparisonData.betting_line.toFixed(1) : 'N/A'}
                </p>
                {comparisonData.odds_bookmaker && (
                  <p className="text-xs text-gray-500 mt-1">via {comparisonData.odds_bookmaker}</p>
                )}
              </div>
            </div>

            {comparisonData.confidence != null && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Model Confidence</p>
                <div className="mt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{comparisonData.confidence.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, comparisonData.confidence))}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {comparisonData.error_margin != null && (
              <div className="text-sm text-gray-500 text-center">
                Error Margin: ±{comparisonData.error_margin.toFixed(1)} points
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerCard;

