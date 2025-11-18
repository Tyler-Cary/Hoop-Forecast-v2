import { motion } from 'framer-motion';

function PropCards({ props, selectedProp, onSelectProp }) {
  if (!props || Object.keys(props).length === 0) {
    return null;
  }

  const propLabels = {
    points: 'Points',
    assists: 'Assists',
    rebounds: 'Rebounds',
    threes: '3Pts Made',
    steals: 'Steals',
    blocks: 'Blocks',
    points_rebounds: 'Pts + Reb',
    points_assists: 'Pts + Ast'
  };

  const formatOdds = (odds) => {
    if (odds == null) return 'N/A';
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  // Debug: Log props to see what we're receiving
  console.log('PropCards - props received:', props);
  console.log('PropCards - prop keys:', Object.keys(props || {}));
  
  // Sort props to display in a consistent order
  const propOrder = ['points', 'assists', 'rebounds', 'threes', 'steals', 'blocks', 'points_rebounds', 'points_assists'];
  const sortedProps = Object.entries(props).sort(([a], [b]) => {
    const aIndex = propOrder.indexOf(a);
    const bIndex = propOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {sortedProps.map(([propType, propData], index) => {
        // Only skip if propData is null/undefined or line is null/undefined
        // Allow line = 0 (which is valid for some props like blocks)
        if (!propData || propData.line == null) {
          console.log(`PropCards - Skipping ${propType}:`, propData);
          return null;
        }
        
        const isSelected = selectedProp === propType;
        const overOdds = propData.over_odds || -110;
        const underOdds = propData.under_odds || -110;
        
        return (
          <motion.button
            key={propType}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectProp(propType)}
            className={`px-4 py-3 rounded-xl transition-all ${
              isSelected
                ? 'bg-yellow-500 text-gray-900 shadow-lg'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          >
            <div className="text-sm font-semibold mb-1">
              {propLabels[propType] || propType}
            </div>
            <div className="text-lg font-bold mb-1">
              {propData.line.toFixed(1)}
            </div>
            <div className="text-xs opacity-90">
              O {formatOdds(overOdds)} | U {formatOdds(underOdds)}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

export default PropCards;

