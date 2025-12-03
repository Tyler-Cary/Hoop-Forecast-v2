import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import PlayerCard from './PlayerCard';
import PredictionChart from './PredictionChart';
import LoadingAnimation from './LoadingAnimation';
import PropCards from './PropCards';
import PropOddsTable from './PropOddsTable';
import GameLogTable from './GameLogTable';
import InjuriesTable from './InjuriesTable';
import PropMetricCard from './PropMetricCard';
import PredictionReasoning from './PredictionReasoning';
import {
  calculateCoverProbability,
  calculateExpectedValue,
  calculateBetRating,
  getCoverProbabilityColor,
  getEVColor,
  getBetRatingColor
} from '../utils/propCalculations';

const API_BASE = '/api';

function PlayerDetail({ player, onBack }) {
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState(null);
  const [selectedProp, setSelectedProp] = useState('points'); // Default to points prop
  const [loadingPredictions, setLoadingPredictions] = useState({}); // Track loading state for each prop
  const [propPredictions, setPropPredictions] = useState({}); // Store predictions for each prop
  const [showReasoning, setShowReasoning] = useState(false); // Toggle for prediction reasoning

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

  // Lazy load prediction when prop tab is clicked
  useEffect(() => {
    if (!comparisonData || !selectedProp) return;
    
    // Points prediction is already loaded in comparisonData
    if (selectedProp === 'points') {
      return;
    }
    
    // Check if we already have this prediction
    if (propPredictions[selectedProp]) {
      return; // Already loaded
    }
    
    // Check if prediction is already in props (from initial load cache)
    const propData = comparisonData.props?.[selectedProp];
    if (propData?.prediction != null) {
      // Prediction already available, store it with full data including analysis
      // First check if we have the full prediction in comparisonData.predictions
      const fullPrediction = comparisonData.predictions?.[selectedProp];
      if (fullPrediction) {
        setPropPredictions(prev => ({
          ...prev,
          [selectedProp]: fullPrediction
        }));
      } else {
        // Fallback: construct from props data
        setPropPredictions(prev => ({
          ...prev,
          [selectedProp]: {
            [`predicted_${selectedProp}`]: propData.prediction,
            confidence: propData.prediction_confidence,
            error_margin: propData.prediction_error_margin,
            analysis: propData.prediction_analysis || null,
            recommendation: propData.prediction_recommendation || null,
            stats: propData.prediction_stats || null
          }
        }));
      }
      return;
    }
    
    // Need to fetch prediction on demand
    const fetchPropPrediction = async () => {
      setLoadingPredictions(prev => ({ ...prev, [selectedProp]: true }));
      
      try {
        const playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
        const params = new URLSearchParams();
        params.append('name', playerName);
        
        const url = `${API_BASE}/player/${player.id || '0'}/prediction/${selectedProp}?${params.toString()}`;
        const response = await axios.get(url);
        
        // Get the actual prediction value - ensure it's a valid number
        const predictedValue = response.data[`predicted_${selectedProp}`] || response.data.predicted_value || response.data.predicted_points;
        
        console.log(`[FetchPrediction] API response for ${selectedProp}:`, {
          responseData: response.data,
          [`predicted_${selectedProp}`]: response.data[`predicted_${selectedProp}`],
          predicted_value: response.data.predicted_value,
          predicted_points: response.data.predicted_points,
          extractedValue: predictedValue
        });
        
        // Validate prediction is a valid number (0 is valid for some props like blocks)
        if (predictedValue == null || isNaN(predictedValue) || predictedValue < 0) {
          console.error(`Invalid prediction value for ${selectedProp}:`, predictedValue);
          // Don't throw error if it's 0 (valid for some props) or if status indicates no line
          if (response.data.status === 'no_line' && predictedValue != null && !isNaN(predictedValue) && predictedValue >= 0) {
            // This is valid - prediction exists but no betting line
            console.log(`[FetchPrediction] Prediction exists but no betting line for ${selectedProp}`);
          } else {
            throw new Error(`Invalid prediction received from API`);
          }
        }
        
        // Update propPredictions first (single source of truth)
        setPropPredictions(prev => ({
          ...prev,
          [selectedProp]: response.data
        }));
        
        // Then update comparisonData props to keep them in sync (include analysis)
        setComparisonData(prev => ({
          ...prev,
          props: {
            ...prev.props,
            [selectedProp]: {
              ...prev.props[selectedProp],
              prediction: predictedValue,
              prediction_confidence: response.data.confidence,
              prediction_error_margin: response.data.error_margin,
              prediction_analysis: response.data.analysis || null,
              prediction_recommendation: response.data.recommendation || null,
              prediction_stats: response.data.stats || null
            }
          },
          // Also update predictions object
          predictions: {
            ...prev.predictions,
            [selectedProp]: response.data
          }
        }));
      } catch (err) {
        console.error(`Error fetching ${selectedProp} prediction:`, err);
        // Don't show error to user, just log it
      } finally {
        setLoadingPredictions(prev => ({ ...prev, [selectedProp]: false }));
      }
    };
    
    fetchPropPrediction();
  }, [selectedProp, comparisonData, player, propPredictions]);

  const fetchComparisonData = async () => {
    setLoading(true);
    setError(null);

    try {
      const playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
      console.log(`Fetching comparison data for player: ${playerName}`);
      
      // Build query params with player name (required)
      const params = new URLSearchParams();
      params.append('name', playerName);
      
      // Use any ID (doesn't matter since we use name)
      const url = `${API_BASE}/player/${player.id || '0'}/compare?${params.toString()}`;
      const response = await axios.get(url);
      console.log('Received comparison data:', response.data);
      
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

        {/* Main Content Skeleton */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="space-y-6 mb-6">
            {/* Top Section: 6 Metric Cards Skeleton (including Season Prop Record) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
                  <div className="h-4 w-24 bg-gray-700 rounded animate-pulse mb-3"></div>
                  <div className="h-10 w-32 bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-20 bg-gray-700 rounded animate-pulse"></div>
                </div>
              ))}
            </div>

            {/* Prediction Reasoning Toggle Skeleton */}
            <div className="h-12 bg-gray-800 rounded-lg border border-gray-700 animate-pulse"></div>

            {/* Chart Skeleton */}
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="h-7 w-32 bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-4 w-64 bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="flex gap-2">
                  {['L5', 'L10', 'L15', 'H2H', 'Season', '2025', '2024'].map((f) => (
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

            {/* Prop Odds Table Skeleton */}
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="h-7 w-32 bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-4 w-40 bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="grid grid-cols-[150px_140px_repeat(6,140px)] gap-2">
                  {/* Header row */}
                  <div className="h-8 bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-8 bg-gray-700 rounded animate-pulse"></div>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-8 bg-gray-700 rounded animate-pulse"></div>
                  ))}
                  {/* Over row */}
                  <div className="h-12 bg-gray-700/50 rounded animate-pulse"></div>
                  <div className="h-12 bg-gray-700/50 rounded animate-pulse"></div>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-12 bg-gray-700/50 rounded animate-pulse"></div>
                  ))}
                  {/* Under row */}
                  <div className="h-12 bg-gray-700/50 rounded animate-pulse"></div>
                  <div className="h-12 bg-gray-700/50 rounded animate-pulse"></div>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-12 bg-gray-700/50 rounded animate-pulse"></div>
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

            {/* Injuries Table Skeleton */}
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
              <div className="h-7 w-32 bg-gray-700 rounded animate-pulse mb-4"></div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-700/50 rounded animate-pulse"></div>
                ))}
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


  return (
    <div className="w-full">
      {/* Breadcrumb Navigation */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="max-w-7xl mx-auto px-4 mb-4"
      >
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <motion.button
            onClick={onBack}
            whileHover={{ x: -4, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <motion.span
              animate={{ x: [0, -4, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              ←
            </motion.span>
            Back
          </motion.button>
          <span>/</span>
          <span className="text-white">Prop Bet Analyzer</span>
          <span>/</span>
          <span className="text-white">{comparisonData?.player || `${player.first_name} ${player.last_name}`}</span>
        </div>
      </motion.div>

      {/* Player Header with Matchup - Full Width Banner (Edge to Edge) */}
      <div className="w-screen relative" style={{ left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw' }}>
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
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
              {/* Opponent Team - Always show if opponent exists, even without logo */}
              {(() => {
                const nextGame = comparisonData.next_game;
                // Check multiple possible fields for opponent
                const opponent = nextGame?.opponent || nextGame?.opponent_name || null;
                const opponentName = nextGame?.opponent_name || nextGame?.opponent || null;
                const hasOpponent = !!opponent;
                
                // Debug logging for Nickeil Alexander-Walker specifically
                if (comparisonData.player && comparisonData.player.toLowerCase().includes('nickeil')) {
                  console.log('🔍 Debug next_game for Nickeil:', {
                    next_game: nextGame,
                    opponent: nextGame?.opponent,
                    opponent_name: nextGame?.opponent_name,
                    opponent_logo: nextGame?.opponent_logo,
                    opponent_record: nextGame?.opponent_record,
                    hasOpponent: hasOpponent,
                    full_comparisonData: comparisonData
                  });
                }
                
                if (!hasOpponent) {
                  // If no opponent in next_game, try to extract from header text as fallback
                  const headerText = `${comparisonData.player_team_name || ''} ${nextGame?.isHome ? 'vs' : '@'} ${nextGame?.opponent_name || nextGame?.opponent || ''}`;
                  if (headerText.includes('@') || headerText.includes('vs')) {
                    console.log('⚠️ No opponent in next_game, but header text suggests opponent exists');
                  }
                  return null;
                }
                
                return (
                  <div className="text-center">
                    {nextGame.opponent_logo && (
                      <img 
                        src={nextGame.opponent_logo} 
                        alt={opponentName}
                        className="w-20 h-20 mx-auto mb-2 object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="text-sm font-semibold text-white mb-1">
                      {opponentName || 'Opponent'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {nextGame.opponent_record || 'N/A'}
                    </div>
                  </div>
                );
              })()}
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
      <div className="space-y-6 mb-6">
        {/* Main Content: Full Width */}
        <div className="space-y-6">
          {/* BettingPros-Style Prop Analysis Section */}
          {comparisonData?.props?.[selectedProp] ? (
            <>
              {/* Top Section: Metric Cards + Season Prop Record */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                {(() => {
                  const propData = comparisonData.props[selectedProp];
                  const line = propData?.line;
                  
                  // Get prediction
                  let prediction = null;
                  if (selectedProp === 'points') {
                    prediction = comparisonData.prediction;
                  } else {
                    const pred = propPredictions[selectedProp];
                    if (pred) {
                      prediction = pred[`predicted_${selectedProp}`] || pred.predicted_value || pred.predicted_points;
                      console.log(`[Projection] Found prediction in propPredictions for ${selectedProp}:`, {
                        pred,
                        [`predicted_${selectedProp}`]: pred[`predicted_${selectedProp}`],
                        predicted_value: pred.predicted_value,
                        predicted_points: pred.predicted_points,
                        final: prediction
                      });
                    } else if (propData?.prediction != null) {
                      prediction = propData.prediction;
                      console.log(`[Projection] Found prediction in propData for ${selectedProp}:`, prediction);
                    } else {
                      console.log(`[Projection] No prediction found for ${selectedProp}:`, {
                        hasPropPredictions: !!propPredictions[selectedProp],
                        hasPropData: !!propData,
                        propDataPrediction: propData?.prediction,
                        loading: loadingPredictions[selectedProp]
                      });
                    }
                  }
                  
                  const recommendation = (prediction != null && line != null) 
                    ? (prediction > line ? 'OVER' : prediction < line ? 'UNDER' : 'PUSH')
                    : null;
                  
                  // Get prop labels
                  const propLabels = {
                    points: 'points',
                    assists: 'assists',
                    rebounds: 'rebounds',
                    threes: '3Pts Made',
                    steals: 'steals',
                    blocks: 'blocks',
                    pra: 'points + rebounds + assists',
                    pr: 'points + rebounds',
                    pa: 'points + assists',
                    ra: 'rebounds + assists',
                    points_rebounds: 'points + rebounds',
                    points_assists: 'points + assists',
                    rebounds_assists: 'rebounds + assists',
                    points_rebounds_assists: 'points + rebounds + assists'
                  };
                  const propLabel = propLabels[selectedProp] || selectedProp.replace(/_/g, ' ');
                  
                  // Calculate cover probability - ALWAYS calculate, use defaults if needed
                  const errorMargin = comparisonData.error_margin || 
                    (propPredictions[selectedProp]?.error_margin) ||
                    (propData?.prediction_error_margin) ||
                    Math.max(2, Math.abs((prediction || 0) - (line || 0)) * 0.3);
                  
                  // Always calculate cover probability, even if prediction/line are missing (use defaults)
                  const coverProbability = (prediction != null && line != null)
                    ? calculateCoverProbability(prediction, line, errorMargin, recommendation === 'OVER')
                    : 50.0; // Default to 50% if no data
                  
                  // Get odds for EV calculation (use best odds from all_bookmakers or single bookmaker)
                  const bestOverOdds = propData?.all_bookmakers?.length > 0
                    ? Math.max(...propData.all_bookmakers.map(bm => bm.over_odds || -110).filter(o => o != null))
                    : propData?.over_odds;
                  
                  const bestUnderOdds = propData?.all_bookmakers?.length > 0
                    ? Math.max(...propData.all_bookmakers.map(bm => bm.under_odds || -110).filter(o => o != null))
                    : propData?.under_odds;
                  
                  const oddsToUse = recommendation === 'OVER' ? bestOverOdds : bestUnderOdds;
                  
                  // Calculate EV - ALWAYS calculate, use default odds if needed
                  const oddsForEV = oddsToUse != null ? oddsToUse : -110; // Default to -110 if no odds
                  const ev = (coverProbability != null)
                    ? calculateExpectedValue(coverProbability, oddsForEV)
                    : 0.0; // Default to 0% if no data
                  
                  // Calculate bet rating - ALWAYS calculate
                  const predictionDiff = (prediction != null && line != null) ? prediction - line : 0;
                  const confidence = comparisonData.confidence || 
                    (propPredictions[selectedProp]?.confidence) ||
                    (propData?.prediction_confidence) ||
                    50; // Default confidence
                  
                  // Always calculate bet rating
                  const betRating = calculateBetRating(ev, coverProbability, predictionDiff, confidence);
                  
                  // Calculate season prop record
                  let seasonRecord = null;
                  let seasonRecordDisplay = 'N/A';
                  if (line && comparisonData?.stats && comparisonData.stats.length > 0) {
                    const getStatValue = (game) => {
                      switch (selectedProp) {
                        case 'points': return typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
                        case 'assists': return typeof game.assists === 'number' ? game.assists : parseFloat(game.assists) || 0;
                        case 'rebounds': return typeof game.rebounds === 'number' ? game.rebounds : parseFloat(game.rebounds) || 0;
                        case 'steals': return typeof game.steals === 'number' ? game.steals : parseFloat(game.steals) || 0;
                        case 'blocks': return typeof game.blocks === 'number' ? game.blocks : parseFloat(game.blocks) || 0;
                        case 'threes': return typeof game.threes_made === 'number' ? game.threes_made : (typeof game.threes === 'number' ? game.threes : parseFloat(game.threes) || 0);
                        case 'pra':
                        case 'points_rebounds_assists': return (game.points || 0) + (game.rebounds || 0) + (game.assists || 0);
                        case 'pr':
                        case 'points_rebounds': return (game.points || 0) + (game.rebounds || 0);
                        case 'pa':
                        case 'points_assists': return (game.points || 0) + (game.assists || 0);
                        case 'ra':
                        case 'rebounds_assists': return (game.rebounds || 0) + (game.assists || 0);
                        default: return typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
                      }
                    };
                    
                    const currentSeasonGames = comparisonData.stats.filter(game => {
                      if (game.season) {
                        return game.season === '2025-26' || game.season.includes('2025-26');
                      }
                      try {
                        const date = new Date(game.date);
                        return date.getFullYear() === 2025;
                      } catch {
                        return false;
                      }
                    });
                    
                    let overCount = 0;
                    let underCount = 0;
                    currentSeasonGames.forEach(game => {
                      const value = getStatValue(game);
                      if (value >= line) overCount++;
                      else underCount++;
                    });
                    
                    if (overCount + underCount > 0) {
                      seasonRecord = `${overCount}-${underCount}`;
                      seasonRecordDisplay = `${overCount}-${underCount} (Over - Under)`;
                    }
                  }
                  
                  return (
                    <>
                      {/* Consensus Line */}
                      <PropMetricCard
                        title="Consensus Line"
                        value={line != null ? `${line.toFixed(1)} ${propLabel} (o/u)` : 'N/A'}
                        color="text-white"
                        valueSize="text-xl"
                        index={0}
                      />
                      
                      {/* Projection */}
                      <PropMetricCard
                        title="Projection"
                        value={prediction != null 
                          ? `${prediction.toFixed(1)} ${propLabel} ${recommendation ? `(${recommendation.toLowerCase()})` : ''}`
                          : loadingPredictions[selectedProp] ? 'Loading...' : 'N/A'}
                        color={recommendation === 'OVER' ? 'text-green-400' : recommendation === 'UNDER' ? 'text-red-400' : 'text-yellow-400'}
                        valueSize="text-xl"
                        index={1}
                      />
                      
                      {/* Cover Probability */}
                      <PropMetricCard
                        title="Cover Probability"
                        value={`${coverProbability.toFixed(0)}%`}
                        color={getCoverProbabilityColor(coverProbability)}
                        progressBar={coverProbability}
                        infoTooltip="The probability that the bet will cover based on our model's prediction and historical performance."
                        infoTooltipLabel="Cover Probability"
                        valueSize="text-3xl"
                        index={2}
                      />
                      
                      {/* Expected Value */}
                      <PropMetricCard
                        title="Expected Value"
                        value={`${ev > 0 ? '+' : ''}${ev.toFixed(1)}%`}
                        color={getEVColor(ev)}
                        infoTooltip="The expected value of the bet calculated from cover probability and current odds. Positive EV indicates a profitable bet over time."
                        infoTooltipLabel="Expected Value"
                        valueSize="text-3xl"
                        index={3}
                      />
                      
                      {/* Bet Rating */}
                      <PropMetricCard
                        title="Bet Rating"
                        customValue={
                          <span className={`inline-flex items-center px-4 py-2 rounded-full text-2xl font-bold ${getBetRatingColor(betRating)} bg-gray-700 border-2 ${getBetRatingColor(betRating).replace('text-', 'border-')}`}>
                            {betRating}
                          </span>
                        }
                        color={getBetRatingColor(betRating)}
                        infoTooltip="Overall bet rating (A+ to F) based on expected value, model confidence, and prediction edge over the betting line."
                        infoTooltipLabel="Bet Rating"
                        index={4}
                      />
                      
                      {/* Season Prop Record */}
                      <PropMetricCard
                        title="Season Prop Record"
                        value={seasonRecordDisplay}
                        color="text-white"
                        valueSize="text-xl"
                        index={5}
                      />
                    </>
                  );
                })()}
              </div>
              
              {/* Prediction Reasoning Toggle */}
              {(() => {
                const propData = comparisonData.props[selectedProp];
                const prediction = selectedProp === 'points' 
                  ? comparisonData.prediction 
                  : (propData?.prediction != null 
                      ? propData.prediction 
                      : (propPredictions[selectedProp] 
                          ? (propPredictions[selectedProp][`predicted_${selectedProp}`] || propPredictions[selectedProp].predicted_value || propPredictions[selectedProp].predicted_points)
                          : null));
                
                if (prediction == null) return null;
                
                return (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowReasoning(!showReasoning)}
                      className="w-full p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-white font-medium flex items-center justify-center gap-2"
                    >
                      <span>{showReasoning ? '▼' : '▶'}</span>
                      <span>{showReasoning ? 'Hide' : 'Show'} Prediction Reasoning</span>
                    </button>
                  </div>
                );
              })()}
            </>
          ) : null}

          {/* Prediction Reasoning - Show when toggled */}
          {showReasoning && (
            <PredictionReasoning 
              predictionData={{
                ...comparisonData,
                // Merge propPredictions into predictions for the component to access
                predictions: {
                  ...comparisonData.predictions,
                  ...propPredictions
                }
              }}
              selectedProp={selectedProp}
              playerName={comparisonData?.player || `${player.first_name} ${player.last_name}`}
            />
          )}

          {/* Chart - Show for all props */}
          {comparisonData?.props?.[selectedProp] && (
            <PredictionChart 
              stats={comparisonData?.stats || []}
              prediction={(() => {
                // Get prediction for selected prop
                if (selectedProp === 'points') {
                  return comparisonData?.prediction;
                }
                // Check if we have the prediction loaded
                const propData = comparisonData?.props?.[selectedProp];
                if (propData?.prediction != null) {
                  return propData.prediction;
                }
                // Check if we have it in propPredictions
                const pred = propPredictions[selectedProp];
                if (pred) {
                  return pred[`predicted_${selectedProp}`] || pred.predicted_value || pred.predicted_points;
                }
                return null;
              })()}
              bettingLine={comparisonData?.props?.[selectedProp]?.line || null}
              selectedProp={selectedProp}
              loading={loadingPredictions[selectedProp]}
              nextGameOpponent={comparisonData?.next_game?.opponent}
            />
          )}

          {/* Prop Odds Table - Under Chart */}
          {comparisonData?.props?.[selectedProp] && (
            <PropOddsTable 
              props={comparisonData?.props || {}}
              selectedProp={selectedProp}
            />
          )}

          {/* Game Log Table */}
          <GameLogTable 
            stats={comparisonData?.stats || []}
            selectedProp={selectedProp}
            prediction={(() => {
              // Get prediction for selected prop
              if (selectedProp === 'points') {
                return comparisonData?.prediction;
              }
              const propData = comparisonData?.props?.[selectedProp];
              if (propData?.prediction != null) {
                return propData.prediction;
              }
              const pred = propPredictions[selectedProp];
              if (pred) {
                return pred[`predicted_${selectedProp}`] || pred.predicted_points;
              }
              return null;
            })()}
            bettingLine={comparisonData?.props?.[selectedProp]?.line || null}
            nextGameOpponent={comparisonData?.next_game?.opponent}
          />

          {/* Injuries Table - Under Game Log */}
          <InjuriesTable 
            injuries={comparisonData?.injuries || null}
            playerTeam={comparisonData?.player_team}
            opponentTeam={comparisonData?.next_game?.opponent}
          />
        </div>
      </div>
      </div>
    </div>
  );
}

export default PlayerDetail;

