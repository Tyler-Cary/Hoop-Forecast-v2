function ComparisonBox({ comparisonData }) {
  if (!comparisonData) {
    return null;
  }

  const { prediction, betting_line, recommendation } = comparisonData;

  // Determine recommendation display
  const getRecommendationDisplay = () => {
    if (!prediction || !betting_line) {
      return { text: 'Insufficient Data', color: 'gray', emoji: '⚪' };
    }

    if (recommendation === 'OVER') {
      return { text: 'Predicted OVER', color: 'green', emoji: '🟢' };
    } else if (recommendation === 'UNDER') {
      return { text: 'Predicted UNDER', color: 'red', emoji: '🔴' };
    } else {
      return { text: 'PUSH', color: 'yellow', emoji: '🟡' };
    }
  };

  const recDisplay = getRecommendationDisplay();
  const difference = prediction && betting_line 
    ? (prediction - betting_line).toFixed(1) 
    : null;

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
      <h3 className="text-2xl font-bold text-white mb-4 text-center">
        Prediction vs. Betting Line
      </h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
          <span className="font-semibold text-gray-300">Our Prediction:</span>
          <span className="text-2xl font-bold text-purple-400">
            {prediction?.toFixed(1) || 'N/A'}
          </span>
        </div>

        <div className="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
          <span className="font-semibold text-gray-300">Sportsbook Line:</span>
          <span className="text-2xl font-bold text-blue-400">
            {betting_line?.toFixed(1) || 'N/A'}
          </span>
        </div>

        {difference && (
          <div className="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
            <span className="font-semibold text-gray-300">Difference:</span>
            <span className={`text-xl font-bold ${
              parseFloat(difference) > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {parseFloat(difference) > 0 ? '+' : ''}{difference}
            </span>
          </div>
        )}

        <div className={`p-6 rounded-lg text-center ${
          recDisplay.color === 'green' ? 'bg-green-900/30 border-2 border-green-500' :
          recDisplay.color === 'red' ? 'bg-red-900/30 border-2 border-red-500' :
          recDisplay.color === 'yellow' ? 'bg-yellow-900/30 border-2 border-yellow-500' :
          'bg-gray-700 border-2 border-gray-500'
        }`}>
          <div className="text-4xl mb-2">{recDisplay.emoji}</div>
          <div className={`text-2xl font-bold ${
            recDisplay.color === 'green' ? 'text-green-400' :
            recDisplay.color === 'red' ? 'text-red-400' :
            recDisplay.color === 'yellow' ? 'text-yellow-400' :
            'text-gray-300'
          }`}>
            {recDisplay.text}
          </div>
          {difference && (
            <p className="text-sm text-gray-400 mt-2">
              {Math.abs(parseFloat(difference)).toFixed(1)} points {parseFloat(difference) > 0 ? 'above' : 'below'} the line
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
        <p className="text-xs text-yellow-300 text-center">
          ⚠️ Predictions are for entertainment purposes only. Always gamble responsibly.
        </p>
      </div>
    </div>
  );
}

export default ComparisonBox;

