import { useState } from 'react';

function GameLogTable({ stats, selectedProp, prediction, bettingLine }) {
  const [seasonFilter, setSeasonFilter] = useState('2025 Season');

  if (!stats || stats.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Player Game Log</h3>
        <p className="text-gray-400 text-center py-8">No game data available</p>
      </div>
    );
  }

  // Get the line to use - for combined props, we need to get it from props
  // For now, only points has prediction, combined props would need their own lines
  const line = bettingLine || (selectedProp === 'points' ? prediction : null);

  // Sort stats: most recent first
  const sortedStats = [...stats].sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateB - dateA;
  });

  // Filter by season if needed - use season field if available, otherwise use date
  let filteredStats = sortedStats;
  if (seasonFilter === '2025 Season') {
    filteredStats = sortedStats.filter(game => {
      // First try to use the season field if available
      if (game.season) {
        // 2025 Season = 2025-26 season (current season)
        return game.season === '2025-26' || game.season.includes('2025-26');
      }
      // Fallback to date parsing - games from 2025 calendar year
      try {
        const date = new Date(game.date);
        return date.getFullYear() === 2025;
      } catch {
        return true;
      }
    });
  } else if (seasonFilter === '2024 Season') {
    filteredStats = sortedStats.filter(game => {
      // First try to use the season field if available
      if (game.season) {
        // 2024 Season = 2024-25 season (previous season)
        return game.season === '2024-25' || game.season.includes('2024-25');
      }
      // Fallback to date parsing - games from 2024 calendar year
      try {
        const date = new Date(game.date);
        return date.getFullYear() === 2024;
      } catch {
        return true;
      }
    });
  }

  const getPropValue = (game) => {
    if (selectedProp === 'points') {
      return game.points || 0;
    } else if (selectedProp === 'assists') {
      return game.assists || 0;
    } else if (selectedProp === 'rebounds') {
      return game.rebounds || 0;
    } else if (selectedProp === 'threes') {
      return game.threes_made || game.threes || 0;
    } else if (selectedProp === 'steals') {
      return game.steals || 0;
    } else if (selectedProp === 'blocks') {
      return game.blocks || 0;
    } else if (selectedProp === 'points_rebounds') {
      // Combined: Points + Rebounds
      return (game.points || 0) + (game.rebounds || 0);
    } else if (selectedProp === 'points_assists') {
      // Combined: Points + Assists
      return (game.points || 0) + (game.assists || 0);
    }
    return game.points || 0;
  };

  const getOverUnder = (game) => {
    if (!line) return null;
    const value = getPropValue(game);
    const lineValue = parseFloat(line);
    
    if (isNaN(lineValue)) return null;
    
    if (value >= lineValue) {
      return { status: 'O', bgColor: 'bg-green-500/20', textColor: 'text-green-400' };
    } else {
      return { status: 'U', bgColor: 'bg-red-500/20', textColor: 'text-red-400' };
    }
  };

  // Calculate over/under record
  const overUnderRecord = filteredStats.reduce((acc, game) => {
    const ou = getOverUnder(game);
    if (ou) {
      if (ou.status === 'O') acc.over++;
      else acc.under++;
    }
    return acc;
  }, { over: 0, under: 0 });

  // Calculate averages
  const calculateAverages = () => {
    if (filteredStats.length === 0) return null;
    
    const totals = filteredStats.reduce((acc, game) => {
      acc.minutes += parseFloat(game.minutes) || 0;
      acc.points += parseFloat(game.points) || 0;
      acc.rebounds += parseFloat(game.rebounds) || 0;
      acc.assists += parseFloat(game.assists) || 0;
      acc.threes += parseFloat(game.threes_made || game.threes) || 0;
      acc.steals += parseFloat(game.steals) || 0;
      acc.blocks += parseFloat(game.blocks) || 0;
      acc.fgm += parseFloat(game.field_goals_made || game.fgm) || 0;
      acc.fga += parseFloat(game.field_goals_attempted || game.fga) || 0;
      acc.ftm += parseFloat(game.free_throws_made || game.ftm) || 0;
      acc.fta += parseFloat(game.free_throws_attempted || game.fta) || 0;
      acc.tpm += parseFloat(game.three_pointers_made || game.threes_made || game.tpm) || 0;
      acc.tpa += parseFloat(game.three_pointers_attempted || game.threes_attempted || game.tpa) || 0;
      acc.propValue += getPropValue(game);
      return acc;
    }, { minutes: 0, points: 0, rebounds: 0, assists: 0, threes: 0, steals: 0, blocks: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, tpm: 0, tpa: 0, propValue: 0 });

    const count = filteredStats.length;
    return {
      minutes: (totals.minutes / count).toFixed(1),
      points: (totals.points / count).toFixed(1),
      rebounds: (totals.rebounds / count).toFixed(1),
      assists: (totals.assists / count).toFixed(1),
      threes: (totals.threes / count).toFixed(1),
      steals: (totals.steals / count).toFixed(1),
      blocks: (totals.blocks / count).toFixed(1),
      fgPct: totals.fga > 0 ? ((totals.fgm / totals.fga) * 100).toFixed(0) : 0,
      ftPct: totals.fta > 0 ? ((totals.ftm / totals.fta) * 100).toFixed(0) : 0,
      tpPct: totals.tpa > 0 ? ((totals.tpm / totals.tpa) * 100).toFixed(0) : 0,
      propValue: (totals.propValue / count).toFixed(1),
      propLine: line ? parseFloat(line).toFixed(1) : 'N/A'
    };
  };

  const averages = calculateAverages();

  const formatDate = (dateStr) => {
    try {
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      }
    } catch (e) {}
    return dateStr || 'N/A';
  };

  const formatScore = (game) => {
    // Try to get score from game data
    if (game.result) {
      return game.result; // e.g., "W 129-111" or "L 129-111"
    }
    return 'N/A';
  };

  const formatSpreadResult = (game) => {
    // This would need spread data from the API
    return 'N/A';
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Player Game Log</h3>
          {overUnderRecord.over + overUnderRecord.under > 0 && (
            <p className="text-sm text-gray-400">
              The Over has hit <span className="text-green-400 font-semibold">{overUnderRecord.over}/{overUnderRecord.over + overUnderRecord.under}</span> this season based on lines for each game.
            </p>
          )}
        </div>
        <select
          value={seasonFilter}
          onChange={(e) => setSeasonFilter(e.target.value)}
          className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500"
        >
          <option>2025 Season</option>
          <option>2024 Season</option>
        </select>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Matchup</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">Score</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">Spread Result</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">Minutes</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">Prop Line</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">
                {selectedProp === 'points_rebounds' ? 'PTS + REBS' : 
                 selectedProp === 'points_assists' ? 'PTS + AST' : 
                 'PTS'}
              </th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">REBS</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">ASSISTS</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">3s Scored</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">STEALS</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">BLOCKS</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">FGM-FGA (%)</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">FTM-FTA (%)</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">3PM-3PA (%)</th>
            </tr>
          </thead>
          <tbody>
            {filteredStats.slice(0, 20).map((game, idx) => {
              const ou = getOverUnder(game);
              const propValue = getPropValue(game);
              const fgm = game.field_goals_made || game.fgm || 0;
              const fga = game.field_goals_attempted || game.fga || 0;
              const fgPct = fga > 0 ? ((fgm / fga) * 100).toFixed(0) : 0;
              const ftm = game.free_throws_made || game.ftm || 0;
              const fta = game.free_throws_attempted || game.fta || 0;
              const ftPct = fta > 0 ? ((ftm / fta) * 100).toFixed(0) : 0;
              const tpm = game.three_pointers_made || game.threes_made || game.tpm || 0;
              const tpa = game.three_pointers_attempted || game.threes_attempted || game.tpa || 0;
              const tpPct = tpa > 0 ? ((tpm / tpa) * 100).toFixed(0) : 0;
              
              const isAway = game.home === false;
              const opponentLabel = isAway ? `@${game.opponent}` : game.opponent;
              
              return (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750/50 transition-colors">
                  <td className="py-3 px-4 text-gray-300 font-medium">{formatDate(game.date)}</td>
                  <td className="py-3 px-4 text-white font-medium">{opponentLabel || 'N/A'}</td>
                  <td className="py-3 px-4 text-center text-gray-300">{formatScore(game)}</td>
                  <td className="py-3 px-4 text-center text-gray-300">{formatSpreadResult(game)}</td>
                  <td className="py-3 px-4 text-center text-gray-300">{game.minutes || 0}</td>
                  <td className={`py-3 px-4 text-center font-semibold ${ou ? ou.bgColor : 'text-gray-400'}`}>
                    {line ? parseFloat(line).toFixed(1) : 'N/A'}
                  </td>
                  <td className={`py-3 px-4 text-center font-semibold ${ou ? ou.textColor : 'text-white'}`}>
                    {propValue} {ou ? ou.status : ''}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-300">{game.rebounds || 0}</td>
                  <td className="py-3 px-4 text-center text-gray-300">{game.assists || 0}</td>
                  <td className="py-3 px-4 text-center text-gray-300">{game.threes_made || game.threes || 0}</td>
                  <td className="py-3 px-4 text-center text-gray-300">{game.steals || 0}</td>
                  <td className="py-3 px-4 text-center text-gray-300">{game.blocks || 0}</td>
                  <td className="py-3 px-4 text-center text-gray-300">{fgm}-{fga} ({fgPct}%)</td>
                  <td className="py-3 px-4 text-center text-gray-300">{ftm}-{fta} ({ftPct}%)</td>
                  <td className="py-3 px-4 text-center text-gray-300">{tpm}-{tpa} ({tpPct}%)</td>
                </tr>
              );
            })}
            {/* Averages Row */}
            {averages && (
              <tr className="border-t-2 border-gray-600 bg-gray-700/30 font-semibold">
                <td className="py-3 px-4 text-white">Averages</td>
                <td className="py-3 px-4"></td>
                <td className="py-3 px-4"></td>
                <td className="py-3 px-4"></td>
                <td className="py-3 px-4 text-center text-white">{averages.minutes}</td>
                <td className="py-3 px-4 text-center text-white">{averages.propLine}</td>
                <td className="py-3 px-4 text-center text-white">{averages.propValue}</td>
                <td className="py-3 px-4 text-center text-white">{averages.rebounds}</td>
                <td className="py-3 px-4 text-center text-white">{averages.assists}</td>
                <td className="py-3 px-4 text-center text-white">{averages.threes}</td>
                <td className="py-3 px-4 text-center text-white">{averages.steals}</td>
                <td className="py-3 px-4 text-center text-white">{averages.blocks}</td>
                <td className="py-3 px-4 text-center text-white">{averages.fgPct}%</td>
                <td className="py-3 px-4 text-center text-white">{averages.ftPct}%</td>
                <td className="py-3 px-4 text-center text-white">{averages.tpPct}%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default GameLogTable;
