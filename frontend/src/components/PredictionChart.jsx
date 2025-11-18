import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

function PredictionChart({ stats, prediction, bettingLine, selectedProp }) {
  const [filter, setFilter] = useState('L15'); // L5, L10, L15, H2H, 2025, 2024

  if (!stats || stats.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
        <h3 className="text-2xl font-bold text-white mb-4">Prop Analysis</h3>
        <p className="text-gray-400 text-center py-8">No game data available</p>
      </div>
    );
  }

  // Get the line to use (betting line takes priority, then prediction)
  const line = bettingLine != null ? bettingLine : (prediction != null ? prediction : null);

  // Sort stats: most recent first
  const sortedStats = [...stats].sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateB - dateA;
  });

  // Determine what stat to chart based on selected prop
  const getChartValue = (game) => {
    if (!selectedProp) {
      return typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
    }
    
    switch (selectedProp) {
      case 'points':
        return typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
      case 'assists':
        return typeof game.assists === 'number' ? game.assists : parseFloat(game.assists) || 0;
      case 'rebounds':
        return typeof game.rebounds === 'number' ? game.rebounds : parseFloat(game.rebounds) || 0;
      case 'steals':
        return typeof game.steals === 'number' ? game.steals : parseFloat(game.steals) || 0;
      case 'blocks':
        return typeof game.blocks === 'number' ? game.blocks : parseFloat(game.blocks) || 0;
      case 'threes':
        return typeof game.threes_made === 'number' ? game.threes_made : (typeof game.threes === 'number' ? game.threes : parseFloat(game.threes) || 0);
      case 'points_rebounds':
        return (game.points || 0) + (game.rebounds || 0);
      case 'points_assists':
        return (game.points || 0) + (game.assists || 0);
      default:
        return typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
    }
  };

  // Filter stats based on selected filter
  let filteredStats = sortedStats;
  if (filter === 'L5') {
    filteredStats = sortedStats.slice(0, 5);
  } else if (filter === 'L10') {
    filteredStats = sortedStats.slice(0, 10);
  } else if (filter === 'L15') {
    filteredStats = sortedStats.slice(0, 15);
  } else if (filter === '2025') {
    filteredStats = sortedStats.filter(game => {
      // First try to use the season field if available
      if (game.season) {
        // 2025 filter = 2025-26 season (current season)
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
  } else if (filter === '2024') {
    filteredStats = sortedStats.filter(game => {
      // First try to use the season field if available
      if (game.season) {
        // 2024 filter = 2024-25 season (previous season)
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
  // H2H would need opponent info, skipping for now

  // Reverse so oldest is on left, newest on right
  const chartData = [...filteredStats].reverse().map((game, index) => {
    const value = getChartValue(game);
    
    // Determine bar color based on line
    let barColor = '#6b7280'; // Default gray
    if (line != null) {
      barColor = value >= line ? '#10b981' : '#ef4444'; // Green if over, red if under
    }
    
    // Format date for label (format: M/D/YY)
    let dateLabel = '';
    try {
      if (game.date) {
        const dateObj = new Date(game.date);
        if (!isNaN(dateObj.getTime())) {
          const month = dateObj.getMonth() + 1;
          const day = dateObj.getDate();
          const year = dateObj.getFullYear().toString().slice(-2);
          dateLabel = `${month}/${day}/${year}`;
        }
      }
    } catch (e) {
      dateLabel = '';
    }
    
    const opponent = game.opponent || 'N/A';
    const isAway = game.home === false;
    const opponentLabel = isAway ? `@${opponent}` : opponent;
    
    return {
      name: `${opponentLabel} ${dateLabel}`,
      points: value,
      date: dateLabel,
      opponent: opponentLabel,
      color: barColor,
      isOver: line != null && value >= line
    };
  });

  // Calculate over/under stats
  const overCount = chartData.filter(d => d.isOver).length;
  const underCount = chartData.length - overCount;
  const dominantResult = overCount > underCount ? 'Over' : 'Under';
  const dominantCount = Math.max(overCount, underCount);

  // Calculate Y-axis domain
  const allValues = chartData.map(d => d.points);
  if (line != null) {
    allValues.push(line);
  }
  const rawMin = Math.min(...allValues, 0);
  const rawMax = Math.max(...allValues);
  
  const minPoints = Math.max(0, Math.floor((rawMin - 5) / 5) * 5);
  const maxPoints = Math.ceil((rawMax + 5) / 5) * 5;
  
  // Generate Y-axis ticks
  const yAxisTicks = [];
  const tickInterval = Math.max(5, Math.ceil((maxPoints - minPoints) / 6));
  for (let i = minPoints; i <= maxPoints; i += tickInterval) {
    yAxisTicks.push(i);
  }
  if (yAxisTicks[yAxisTicks.length - 1] < maxPoints) {
    yAxisTicks.push(maxPoints);
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">Prop Analysis</h3>
          {line != null && chartData.length > 0 && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-gray-400"
            >
              The <span className="font-semibold text-white">{dominantResult}</span> hit <span className="font-semibold text-white">{dominantCount}/{chartData.length}</span> in the last {chartData.length} games at a line of <span className="font-semibold text-white">{line.toFixed(1)}</span>
            </motion.p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {['L5', 'L10', 'L15', 'H2H', '2025', '2024'].map((f) => (
            <motion.button
              key={f}
              onClick={() => setFilter(f)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all duration-200 ${
                filter === f
                  ? 'bg-yellow-500 text-gray-900 font-semibold shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f}
            </motion.button>
          ))}
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </motion.button>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={400}>
        <BarChart 
          data={chartData}
          margin={{ top: 20, right: 50, left: 20, bottom: 60 }}
          barCategoryGap="10%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" vertical={false} opacity={0.3} />
          <XAxis 
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500, fontFamily: 'Poppins' }}
            tickLine={{ stroke: '#6b7280' }}
          />
          <YAxis 
            domain={[minPoints, maxPoints]}
            stroke="#9ca3af"
            strokeWidth={1}
            tick={{ fill: '#d1d5db', fontSize: 12, fontWeight: 500, fontFamily: 'Poppins' }}
            tickLine={{ stroke: '#6b7280' }}
            width={40}
            ticks={yAxisTicks}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '10px',
              fontFamily: 'Poppins'
            }}
            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
            formatter={(value) => {
              const propLabel = selectedProp === 'points' ? 'pts' :
                               selectedProp === 'assists' ? 'ast' :
                               selectedProp === 'rebounds' ? 'reb' :
                               selectedProp === 'steals' ? 'stl' :
                               selectedProp === 'blocks' ? 'blk' :
                               selectedProp === 'threes' ? '3pm' :
                               selectedProp === 'points_rebounds' ? 'pts+reb' :
                               selectedProp === 'points_assists' ? 'pts+ast' : 'value';
              return [`${value.toFixed(1)} ${propLabel}`, 'Value'];
            }}
            labelFormatter={(label) => <span style={{ fontWeight: 600, fontSize: '13px' }}>{label}</span>}
          />
          
          {/* Bars */}
          <Bar 
            dataKey="points" 
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                stroke={entry.color}
                strokeWidth={0}
                opacity={0.9}
              />
            ))}
          </Bar>
          
          {/* Reference line at betting line - white line like reference */}
          {line != null && (
            <ReferenceLine 
              y={line} 
              stroke="#ffffff" 
              strokeWidth={2}
              strokeDasharray="0"
              label={({ viewBox }) => {
                // Position label above the line on the right side
                const labelY = viewBox.y - 12; // Position 12px above the line
                return (
                  <text
                    x={viewBox.width - 10}
                    y={labelY}
                    fill="#ffffff"
                    fontSize={11}
                    fontWeight={600}
                    fontFamily="Poppins"
                    textAnchor="end"
                  >
                    {line.toFixed(1)}
                  </text>
                );
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export default PredictionChart;
