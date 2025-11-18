function PropOddsTable({ props, selectedProp }) {
  if (!props || !selectedProp || !props[selectedProp]) {
    return null;
  }

  const propData = props[selectedProp];
  const propLabels = {
    points: 'Over/Under Points',
    assists: 'Over/Under Assists',
    rebounds: 'Over/Under Rebounds',
    threes: 'Over/Under 3Pts Made',
    steals: 'Over/Under Steals',
    blocks: 'Over/Under Blocks',
    points_rebounds: 'Over/Under Points + Rebounds',
    points_assists: 'Over/Under Points + Assists'
  };

  const formatOdds = (odds) => {
    if (odds == null) return 'N/A';
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  // For now, we only have data from one bookmaker per prop
  // In the future, we could fetch odds from multiple sportsbooks
  const bookmakers = propData.bookmaker ? [{
    name: propData.bookmaker,
    overOdds: propData.over_odds || -110,
    underOdds: propData.under_odds || -110,
    line: propData.line
  }] : [];

  if (bookmakers.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Prop Odds</h3>
        <div className="text-sm text-gray-400">
          {propLabels[selectedProp] || selectedProp.replace(/_/g, ' + ')}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Sportsbook</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">Over</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">Line</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">Under</th>
            </tr>
          </thead>
          <tbody>
            {bookmakers.map((bookmaker, idx) => (
              <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-3 px-4 text-white font-medium">{bookmaker.name}</td>
                <td className="py-3 px-4 text-center text-green-400 font-semibold">
                  {bookmaker.line.toFixed(1)} O {formatOdds(bookmaker.overOdds)}
                </td>
                <td className="py-3 px-4 text-center text-gray-300 font-bold">
                  {bookmaker.line.toFixed(1)}
                </td>
                <td className="py-3 px-4 text-center text-red-400 font-semibold">
                  {bookmaker.line.toFixed(1)} U {formatOdds(bookmaker.underOdds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {bookmakers.length === 1 && (
        <p className="text-xs text-gray-500 mt-4 text-center">
          More sportsbooks coming soon
        </p>
      )}
    </div>
  );
}

export default PropOddsTable;

