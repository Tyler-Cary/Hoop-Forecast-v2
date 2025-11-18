import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import PlayerCard from './PlayerCard';
import PredictionChart from './PredictionChart';
import ComparisonBox from './ComparisonBox';
import LoadingAnimation from './LoadingAnimation';
import PropCards from './PropCards';
import PropOddsTable from './PropOddsTable';
import GameLogTable from './GameLogTable';

const API_BASE = '/api';

function PlayerDetail({ player, onBack }) {
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState(null);
  const [selectedProp, setSelectedProp] = useState('points'); // Default to points prop

  useEffect(() => {
    // Reset loading state immediately when player changes
    setLoading(true);
    setError(null);
    setComparisonData(null);
    fetchComparisonData();
  }, [player.id]);

  // Auto-select first available prop if current selection is not available
  // MUST be before any early returns to follow Rules of Hooks
  useEffect(() => {
    if (!comparisonData) return;
    
    if (comparisonData.props && Object.keys(comparisonData.props).length > 0) {
      // Check if current selection is available, if not select first available
      const availableProps = Object.keys(comparisonData.props);
      if (!availableProps.includes(selectedProp)) {
        setSelectedProp(availableProps[0]);
      }
      // Safe: If selectedProp is already in availableProps, we don't call setSelectedProp, so no loop
    } else {
      // If no props available, default to points (even if not available, UI will handle it)
      if (selectedProp !== 'points') {
        setSelectedProp('points');
      }
    }
  }, [comparisonData, selectedProp]); // selectedProp needed to check current selection

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
      
      console.log('Received comparison data:', response.data);
      console.log('Props available:', Object.keys(response.data?.props || {}));
      console.log('Props details:', JSON.stringify(response.data?.props, null, 2));
      
      // Ensure props is always an object
      if (!response.data.props) {
        response.data.props = {};
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
        recommendation: 'N/A',
        props: {} // Ensure props object exists
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full">
        {/* Breadcrumb Navigation Skeleton */}
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={onBack}
              className="hover:text-white transition-colors text-gray-400"
            >
              ← Back
            </button>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">Prop Bet Analyzer</span>
            <span className="text-gray-600">/</span>
            <div className="h-4 w-32 bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Banner Skeleton */}
        <div className="w-screen relative" style={{ left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw' }}>
          <div className="bg-gray-800 shadow-xl p-6 mb-6 border-b border-t border-gray-700">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-start gap-8">
                {/* Player Image Skeleton */}
                <div className="w-40 h-40 rounded-full bg-gray-700 animate-pulse flex-shrink-0"></div>
                
                {/* Player Info Skeleton */}
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-32 bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-8 w-48 bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-4 w-40 bg-gray-700 rounded animate-pulse"></div>
                </div>
                
                {/* Matchup Skeleton */}
                <div className="flex items-center gap-8 flex-shrink-0">
                  <div className="text-center space-y-2">
                    <div className="w-20 h-20 bg-gray-700 rounded animate-pulse mx-auto"></div>
                    <div className="h-4 w-24 bg-gray-700 rounded animate-pulse mx-auto"></div>
                    <div className="h-3 w-16 bg-gray-700 rounded animate-pulse mx-auto"></div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="h-5 w-32 bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-3 w-24 bg-gray-700 rounded animate-pulse"></div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-20 h-20 bg-gray-700 rounded animate-pulse mx-auto"></div>
                    <div className="h-4 w-24 bg-gray-700 rounded animate-pulse mx-auto"></div>
                    <div className="h-3 w-16 bg-gray-700 rounded animate-pulse mx-auto"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Prop Cards Skeleton */}
        <div className="max-w-7xl mx-auto px-4 mb-6">
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="h-24 w-32 bg-gray-800 rounded-xl border border-gray-700 animate-pulse"
              >
                <div className="p-3 h-full flex flex-col justify-between">
                  <div className="h-4 w-20 bg-gray-700 rounded"></div>
                  <div className="h-6 w-16 bg-gray-700 rounded"></div>
                  <div className="h-3 w-24 bg-gray-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Grid Skeleton */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Left Column Skeleton */}
            <div className="lg:col-span-2 space-y-6">
              {/* Prop Analysis Skeleton */}
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
                <div className="h-7 w-48 bg-gray-700 rounded animate-pulse mb-4"></div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="h-16 bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-16 bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>

              {/* Chart Skeleton */}
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-7 w-32 bg-gray-700 rounded animate-pulse"></div>
                  <div className="flex gap-2">
                    {['L5', 'L10', 'L15'].map((f) => (
                      <div key={f} className="h-8 w-12 bg-gray-700 rounded animate-pulse"></div>
                    ))}
                  </div>
                </div>
                <div className="h-96 bg-gray-700/50 rounded-lg animate-pulse relative overflow-hidden">
                  {/* Simulated chart bars */}
                  <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around px-4 pb-4 gap-2">
                    {[20, 35, 45, 30, 50, 40, 55, 35, 45, 50, 30, 40, 45, 35, 50].map((height, i) => (
                      <div
                        key={i}
                        className="w-6 bg-gray-600 rounded-t animate-pulse"
                        style={{ height: `${height}%`, animationDelay: `${i * 50}ms` }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Game Log Skeleton */}
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-7 w-40 bg-gray-700 rounded animate-pulse"></div>
                  <div className="flex gap-2">
                    <div className="h-8 w-24 bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-8 w-24 bg-gray-700 rounded animate-pulse"></div>
                  </div>
                </div>
                {/* Table header skeleton */}
                <div className="grid grid-cols-8 gap-2 mb-2 pb-2 border-b border-gray-700">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="h-4 bg-gray-700 rounded animate-pulse"></div>
                  ))}
                </div>
                {/* Table rows skeleton */}
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                    <div key={i} className="grid grid-cols-8 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                        <div key={j} className="h-8 bg-gray-700/50 rounded animate-pulse"></div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column Skeleton */}
            <div className="space-y-6">
              {/* Prop Odds Skeleton */}
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
                <div className="h-7 w-32 bg-gray-700 rounded animate-pulse mb-4"></div>
                <div className="space-y-3">
                  <div className="h-12 bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-12 bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>

              {/* Comparison Box Skeleton */}
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
                <div className="h-7 w-40 bg-gray-700 rounded animate-pulse mb-4"></div>
                <div className="space-y-3">
                  <div className="h-16 bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-16 bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
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

  if (!comparisonData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          <p className="text-gray-400 text-center">Loading player data...</p>
        </div>
      </div>
    );
  }

  // Debug: Log comparisonData to help diagnose issues
  console.log('PlayerDetail render - comparisonData:', comparisonData);
  console.log('PlayerDetail render - selectedProp:', selectedProp);
  console.log('PlayerDetail render - props:', comparisonData?.props);

  return (
    <div className="w-full">
      {/* Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <button
            onClick={onBack}
            className="hover:text-white transition-colors"
          >
            ← Back
          </button>
          <span>/</span>
          <span className="text-white">Prop Bet Analyzer</span>
          <span>/</span>
          <span className="text-white">{comparisonData?.player || `${player.first_name} ${player.last_name}`}</span>
        </div>
      </div>

      {/* Player Header with Matchup - Full Width Banner (Edge to Edge) */}
      <div className="w-screen relative" style={{ left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw' }}>
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gray-800 shadow-xl p-6 mb-6 border-b border-t border-gray-700"
        >
          <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-start gap-8">
          {/* Player Image */}
          {comparisonData?.player_image && (
            <img 
              src={comparisonData.player_image} 
              alt={comparisonData.player || 'Player'}
              className="w-40 h-40 rounded-full object-cover border-4 border-gray-600 flex-shrink-0"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
          
          {/* Player Info */}
          <div className="flex-1">
            <div className="text-sm text-gray-400 mb-1">Prop Bet Analyzer</div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {comparisonData?.player || `${player.first_name} ${player.last_name}`}
            </h1>
            <div className="flex items-center gap-4 text-gray-400">
              <span>{player.position || 'N/A'}</span>
              {comparisonData?.next_game && (
                <>
                  <span>•</span>
                  <span>
                    {comparisonData.player_team_name || player.team?.abbreviation || 'N/A'} {comparisonData.next_game.isHome ? 'vs' : '@'} {comparisonData.next_game.opponent_name || comparisonData.next_game.opponent || 'TBD'}
                  </span>
                </>
              )}
            </div>
          </div>
          
          {/* Matchup Section - To the right of player info */}
          {comparisonData?.next_game && (
            <div className="flex items-center gap-8 flex-shrink-0">
              {comparisonData.player_team_logo && (
                <div className="text-center">
                  <img 
                    src={comparisonData.player_team_logo} 
                    alt={comparisonData.player_team_name || 'Team'}
                    className="w-20 h-20 mx-auto mb-2 object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="text-sm font-semibold text-white mb-1">
                    {comparisonData.player_team_name || 'Team'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {comparisonData.player_team_record || 'N/A'}
                  </div>
                </div>
              )}
              <div className="text-center">
                <div className="text-lg font-bold text-white mb-1">
                  {comparisonData.next_game.date ? (() => {
                    try {
                      const date = new Date(comparisonData.next_game.date);
                      if (isNaN(date.getTime())) {
                        return comparisonData.next_game.date;
                      }
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
                    } catch (e) {
                      return comparisonData.next_game.date || 'TBD';
                    }
                  })() : 'TBD'}
                </div>
                <div className="text-xs text-gray-400">
                  {comparisonData.next_game.date ? (() => {
                    try {
                      const date = new Date(comparisonData.next_game.date);
                      if (isNaN(date.getTime())) {
                        return comparisonData.next_game.time || '';
                      }
                      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
                      const time = comparisonData.next_game.time || '';
                      return time ? `${dayOfWeek}, ${time}` : dayOfWeek;
                    } catch (e) {
                      return comparisonData.next_game.time || '';
                    }
                  })() : comparisonData.next_game.time || ''}
                </div>
              </div>
              {comparisonData.next_game.opponent_logo && (
                <div className="text-center">
                  <img 
                    src={comparisonData.next_game.opponent_logo} 
                    alt={comparisonData.next_game.opponent_name || comparisonData.next_game.opponent}
                    className="w-20 h-20 mx-auto mb-2 object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="text-sm font-semibold text-white mb-1">
                    {comparisonData.next_game.opponent_name || comparisonData.next_game.opponent || 'Opponent'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {comparisonData.next_game.opponent_record || 'N/A'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
        </motion.div>
      </div>

      {/* Prop Cards - Display all available props */}
      <div className="max-w-7xl mx-auto px-4">
        {(() => {
          const props = comparisonData?.props || {};
          const propKeys = Object.keys(props);
          console.log('🔍 PlayerDetail - Rendering props:', {
            hasProps: propKeys.length > 0,
            propKeys: propKeys,
            propsData: props,
            selectedProp: selectedProp
          });
          
          // Log each prop to see why it might be filtered
          propKeys.forEach(key => {
            const prop = props[key];
            console.log(`  - ${key}:`, {
              hasData: !!prop,
              line: prop?.line,
              lineType: typeof prop?.line,
              over_odds: prop?.over_odds,
              under_odds: prop?.under_odds,
              willDisplay: prop && prop.line != null
            });
          });
          
          return propKeys.length > 0 ? (
            <PropCards 
              props={props}
              selectedProp={selectedProp}
              onSelectProp={setSelectedProp}
            />
          ) : (
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-6 border border-gray-700">
              <p className="text-gray-400 text-center">No prop bets available for this player</p>
              <p className="text-gray-500 text-center text-xs mt-2">Props object: {JSON.stringify(props)}</p>
            </div>
          );
        })()}
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column: Analysis */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prop Analysis Section */}
          {comparisonData?.props?.[selectedProp] ? (
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">
                {(() => {
                  const propLabels = {
                    points: 'Points',
                    assists: 'Assists',
                    rebounds: 'Rebounds',
                    threes: '3Pts Made',
                    steals: 'Steals',
                    blocks: 'Blocks',
                    points_rebounds: 'Points + Rebounds',
                    points_assists: 'Points + Assists'
                  };
                  return (propLabels[selectedProp] || selectedProp.charAt(0).toUpperCase() + selectedProp.slice(1).replace(/_/g, ' ')) + ' Prop Analysis';
                })()}
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Consensus Line</div>
                  <div className="text-2xl font-bold text-white">
                    {comparisonData.props[selectedProp]?.line?.toFixed(1) || 'N/A'} {(() => {
                      const propLabels = {
                        points: 'points',
                        assists: 'assists',
                        rebounds: 'rebounds',
                        threes: '3Pts Made',
                        steals: 'steals',
                        blocks: 'blocks',
                        points_rebounds: 'points + rebounds',
                        points_assists: 'points + assists'
                      };
                      return propLabels[selectedProp] || selectedProp.replace(/_/g, ' ');
                    })()}
                  </div>
                </div>
                {selectedProp === 'points' && comparisonData.prediction != null && (
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Projection</div>
                    <div className="text-2xl font-bold text-green-400">
                      {comparisonData.prediction.toFixed(1)} points ({comparisonData.recommendation === 'OVER' ? 'over' : comparisonData.recommendation === 'UNDER' ? 'under' : 'push'})
                    </div>
                  </div>
                )}
              </div>
              {selectedProp === 'points' && comparisonData.recommendation && comparisonData.recommendation !== 'N/A' && (
                <div className="mt-4 p-4 rounded-lg bg-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Bet Rating</div>
                  <div className={`text-lg font-bold ${
                    comparisonData.recommendation === 'OVER' ? 'text-green-400' : 
                    comparisonData.recommendation === 'UNDER' ? 'text-red-400' : 
                    'text-yellow-400'
                  }`}>
                    {comparisonData.recommendation}
                  </div>
                </div>
              )}
            </div>
          ) : selectedProp === 'points' && comparisonData?.prediction != null && (
            // Fallback: Show points analysis even if no props available
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Points Prop Analysis</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Betting Line</div>
                  <div className="text-2xl font-bold text-white">
                    {comparisonData.betting_line?.toFixed(1) || 'N/A'} points
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">Projection</div>
                  <div className="text-2xl font-bold text-green-400">
                    {comparisonData.prediction.toFixed(1)} points ({comparisonData.recommendation === 'OVER' ? 'over' : comparisonData.recommendation === 'UNDER' ? 'under' : 'push'})
                  </div>
                </div>
              </div>
              {comparisonData.recommendation && comparisonData.recommendation !== 'N/A' && (
                <div className="mt-4 p-4 rounded-lg bg-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Bet Rating</div>
                  <div className={`text-lg font-bold ${
                    comparisonData.recommendation === 'OVER' ? 'text-green-400' : 
                    comparisonData.recommendation === 'UNDER' ? 'text-red-400' : 
                    'text-yellow-400'
                  }`}>
                    {comparisonData.recommendation}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chart - Show for all props */}
          {comparisonData?.props?.[selectedProp] && (
            <PredictionChart 
              stats={comparisonData?.stats || []}
              prediction={selectedProp === 'points' ? comparisonData?.prediction : null}
              bettingLine={comparisonData?.props?.[selectedProp]?.line || (selectedProp === 'points' ? comparisonData?.betting_line : null)}
              selectedProp={selectedProp}
            />
          )}

          {/* Game Log Table */}
          <GameLogTable 
            stats={comparisonData?.stats || []}
            selectedProp={selectedProp}
            prediction={selectedProp === 'points' ? comparisonData?.prediction : null}
            bettingLine={comparisonData?.props?.[selectedProp]?.line || (selectedProp === 'points' ? comparisonData?.betting_line : null)}
          />
        </div>

        {/* Right Column: Odds and Comparison */}
        <div className="space-y-6">
          <PropOddsTable 
            props={comparisonData?.props || {}}
            selectedProp={selectedProp}
          />
          {selectedProp === 'points' && (
            <ComparisonBox comparisonData={comparisonData} />
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default PlayerDetail;

