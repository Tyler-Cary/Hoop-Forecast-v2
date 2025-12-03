import { motion } from 'framer-motion';
import { getSportsbookLogo, getSportsbookDisplayName, normalizeSportsbookName } from '../utils/sportsbookLogos';

// Sportsbook priority order (matches BettingPros)
const SPORTSBOOK_ORDER = [
  'draftkings',
  'fanduel',
  'betmgm',
  'caesars',
  'bovada',
  'prizepicks',
  'hardrock',
  'hardrockbet',
  'espnbet',
  'fanatics',
  'underdog',
  'underdogfantasy',
  'barstool',
  'betrivers',
  'betonline',
  'williamhill',
  'pointsbet',
  'superbook'
];

function getSportsbookInfo(bookmakerKeyOrName) {
  if (!bookmakerKeyOrName) return null;
  
  const logo = getSportsbookLogo(bookmakerKeyOrName);
  const displayName = getSportsbookDisplayName(bookmakerKeyOrName);
  
    return {
    name: displayName,
    logo: logo,
    displayName: displayName.toUpperCase()
  };
}

function getSportsbookPriority(bookmakerKey) {
  if (!bookmakerKey) return 9999;
  const normalized = normalizeSportsbookName(bookmakerKey);
  const index = SPORTSBOOK_ORDER.findIndex(sb => {
    const normalizedSb = normalizeSportsbookName(sb);
    return normalized.includes(normalizedSb) || normalizedSb.includes(normalized);
  });
  return index === -1 ? 9999 : index;
}

// Format odds
function formatOdds(odds) {
  if (odds == null) return 'N/A';
  return odds > 0 ? `+${odds}` : `${odds}`;
}

// Format prop label
function getPropDisplayLabel(prop) {
  const labels = {
    points: 'Pts',
    assists: 'Ast',
    rebounds: 'Reb',
    threes: '3PM',
    steals: 'Stl',
    blocks: 'Blk',
    points_rebounds: 'Pts + Reb',
    points_assists: 'Pts + Ast',
    rebounds_assists: 'Reb + Ast',
    pra: 'Pts + Ast + Reb',
    pr: 'Pts + Reb',
    pa: 'Pts + Ast',
    ra: 'Reb + Ast',
    points_rebounds_assists: 'Pts + Ast + Reb'
  };
  return labels[prop] || prop.replace(/_/g, ' + ');
}

// OddsRow Component - Single Over or Under row
function OddsRow({ type, line, odds, isBest }) {
  const label = type === 'over' ? 'O' : 'U';
  const bgColor = isBest 
    ? (type === 'over' ? 'bg-[#697843]' : 'bg-[#7c6a42]')
    : 'bg-[#3d4f66]';
  
  if (line == null || odds == null) {
    return (
      <div className={`${bgColor} rounded-lg px-3 py-2.5 text-center`}>
        <span className="text-white text-sm font-medium opacity-50">N/A</span>
      </div>
    );
  }

  return (
    <div className={`${bgColor} rounded-lg px-3 py-2.5 text-center`}>
      <span className="text-white font-bold text-base">
        {label} {parseFloat(line).toFixed(1)} <span className="text-sm font-normal">({formatOdds(odds)})</span>
      </span>
    </div>
  );
}

// SportsbookCard Component - Individual sportsbook column
function SportsbookCard({ bookmaker, bestOverOdds, bestUnderOdds, sportsbookInfo }) {
  const isOverBest = bookmaker.over_odds === bestOverOdds;
  const isUnderBest = bookmaker.under_odds === bestUnderOdds;
  
  return (
    <div className="flex-shrink-0 w-[165px]">
      {/* Over Row */}
      <div className="mb-2">
        <OddsRow 
          type="over" 
          line={bookmaker.line} 
          odds={bookmaker.over_odds}
          isBest={isOverBest}
        />
      </div>
      
      {/* Under Row */}
      <div>
        <OddsRow 
          type="under" 
          line={bookmaker.line} 
          odds={bookmaker.under_odds}
          isBest={isUnderBest}
        />
      </div>
    </div>
  );
}

// Main PropOddsContainer Component
function PropOddsTable({ props, selectedProp }) {
  if (!props || !selectedProp || !props[selectedProp]) {
    return null;
  }

  const propData = props[selectedProp];
  
  // Get all bookmakers from prop data
  let allBookmakers = [];
  
  if (propData.all_bookmakers && Array.isArray(propData.all_bookmakers)) {
    allBookmakers = propData.all_bookmakers;
  } else if (propData.bookmaker) {
    // Fallback to single bookmaker format
    allBookmakers = [{
      bookmaker: propData.bookmaker,
      bookmaker_key: propData.bookmaker_key || propData.bookmaker.toLowerCase().replace(/\s+/g, '_'),
      line: propData.line,
      over_odds: propData.over_odds || -110,
      under_odds: propData.under_odds || -110
    }];
  }

  if (allBookmakers.length === 0) {
    return null;
  }

  // Remove duplicates by bookmaker key (keep first occurrence)
  const seenKeys = new Set();
  const uniqueBookmakers = [];
  
  for (const bm of allBookmakers) {
    const key = (bm.bookmaker_key || bm.bookmaker || '').toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueBookmakers.push(bm);
    }
  }
  
  allBookmakers = uniqueBookmakers;

  // Sort by priority order
  allBookmakers.sort((a, b) => {
    const priorityA = getSportsbookPriority(a.bookmaker_key || a.bookmaker);
    const priorityB = getSportsbookPriority(b.bookmaker_key || b.bookmaker);
    return priorityA - priorityB;
  });

  // Calculate consensus line (OPEN LINE) - most common line
  const lineCounts = {};
  allBookmakers.forEach(bm => {
    if (bm.line != null) {
      const lineKey = parseFloat(bm.line).toFixed(1);
      lineCounts[lineKey] = (lineCounts[lineKey] || 0) + 1;
    }
  });
  
  let consensusLine = propData.line;
  if (Object.keys(lineCounts).length > 0) {
    const mostCommonLine = Object.entries(lineCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
    consensusLine = parseFloat(mostCommonLine);
  }
  
  // Calculate consensus odds (average of all books with consensus line)
  const booksWithConsensusLine = allBookmakers.filter(bm => 
    bm.line != null && Math.abs(bm.line - consensusLine) < 0.1
  );
  
  let consensusOverOdds = -110;
  let consensusUnderOdds = -110;
  
  if (booksWithConsensusLine.length > 0) {
    const avgOver = booksWithConsensusLine.reduce((sum, bm) => sum + (bm.over_odds || -110), 0) / booksWithConsensusLine.length;
    const avgUnder = booksWithConsensusLine.reduce((sum, bm) => sum + (bm.under_odds || -110), 0) / booksWithConsensusLine.length;
    consensusOverOdds = Math.round(avgOver);
    consensusUnderOdds = Math.round(avgUnder);
  }

  // Calculate best odds (highest = best for bettor)
  const bestOverOdds = allBookmakers.reduce((best, bm) => {
    if (bm.over_odds == null) return best;
    if (best == null) return bm.over_odds;
    return bm.over_odds > best ? bm.over_odds : best;
  }, null);

  const bestUnderOdds = allBookmakers.reduce((best, bm) => {
    if (bm.under_odds == null) return best;
    if (best == null) return bm.under_odds;
    return bm.under_odds > best ? bm.under_odds : best;
  }, null);

  const bestOverBookmaker = allBookmakers.find(bm => bm.over_odds === bestOverOdds);
  const bestUnderBookmaker = allBookmakers.find(bm => bm.under_odds === bestUnderOdds);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="bg-[#1a2332] rounded-xl p-6 border border-gray-700/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Prop Odds</h3>
        <a 
          href="#" 
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          onClick={(e) => e.preventDefault()}
        >
          View All Prop Odds →
        </a>
      </div>
      
      {/* Odds Grid */}
      <div className="overflow-x-auto">
        <div className="flex gap-0">
          {/* Left Label Column */}
          <div className="flex-shrink-0 w-[100px] pr-0 mr-4">
            <div className="h-full flex flex-col justify-center">
              <div className="text-xs text-gray-400 font-normal mb-1">Over/Under</div>
              <div className="text-3xl font-bold text-white leading-tight">{getPropDisplayLabel(selectedProp)}</div>
            </div>
              </div>

          {/* Scrollable Sportsbook Cards Container */}
          <div className="flex flex-col gap-4">
            {/* Filter Buttons Row */}
            <div className="flex gap-2">
              <button className="flex-shrink-0 w-[165px] px-4 py-2.5 bg-[#3d4f66] text-white rounded-lg text-sm font-bold hover:bg-[#4a5d77] transition-colors">
                OPEN LINE
              </button>
              <button className="flex-shrink-0 w-[165px] px-4 py-2.5 bg-[#f9c744] text-gray-900 rounded-lg text-sm font-bold hover:bg-[#fad15c] transition-colors flex items-center justify-center gap-2">
                <span className="text-base">⚙</span>
                BEST ODDS
              </button>
              {allBookmakers.map((bookmaker, idx) => {
              const sportsbookInfo = getSportsbookInfo(bookmaker.bookmaker_key || bookmaker.bookmaker);
              return (
                  <button
                    key={`${bookmaker.bookmaker_key || bookmaker.bookmaker}-${idx}`}
                    className="flex-shrink-0 w-[165px] px-3 py-2.5 bg-[#2a3544] hover:bg-[#344052] rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 border border-gray-600/50"
                    >
                      <img
                      src={sportsbookInfo?.logo}
                        alt={sportsbookInfo?.displayName || bookmaker.bookmaker}
                      className="w-6 h-6 object-contain"
                        onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <span className="text-xs truncate">
                      {sportsbookInfo?.displayName || bookmaker.bookmaker.toUpperCase()}
                    </span>
                  </button>
              );
            })}
          </div>
          
            {/* Odds Cards Row */}
            <div className="flex gap-2">
            {/* OPEN LINE Card */}
            <div className="flex-shrink-0 w-[165px]">
              <div className="mb-2">
                <OddsRow 
                  type="over" 
                  line={consensusLine} 
                  odds={consensusOverOdds}
                  isBest={false}
                        />
                      </div>
              <div>
                <OddsRow 
                  type="under" 
                  line={consensusLine} 
                  odds={consensusUnderOdds}
                  isBest={false}
                />
                </div>
          </div>
          
            {/* BEST ODDS Card */}
            <div className="flex-shrink-0 w-[165px]">
              <div className="mb-2 relative">
                {bestOverBookmaker ? (
                  <>
                    <div className="absolute top-2 right-2 z-10 flex items-center justify-center">
                      <img
                        src={getSportsbookInfo(bestOverBookmaker.bookmaker_key || bestOverBookmaker.bookmaker)?.logo}
                        alt=""
                        className="w-6 h-6 object-contain rounded"
                        onError={(e) => e.target.style.display = 'none'}
                        />
                      </div>
                    <OddsRow 
                      type="over" 
                      line={bestOverBookmaker.line} 
                      odds={bestOverBookmaker.over_odds}
                      isBest={true}
                    />
                  </>
                ) : (
                  <OddsRow type="over" line={null} odds={null} isBest={false} />
                )}
              </div>
              <div className="relative">
                {bestUnderBookmaker ? (
                  <>
                    <div className="absolute top-2 right-2 z-10 flex items-center justify-center">
                      <img
                        src={getSportsbookInfo(bestUnderBookmaker.bookmaker_key || bestUnderBookmaker.bookmaker)?.logo}
                        alt=""
                        className="w-6 h-6 object-contain rounded"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                </div>
                    <OddsRow 
                      type="under" 
                      line={bestUnderBookmaker.line} 
                      odds={bestUnderBookmaker.under_odds}
                      isBest={true}
                    />
                  </>
                ) : (
                  <OddsRow type="under" line={null} odds={null} isBest={false} />
                )}
              </div>
            </div>

            {/* Individual Sportsbook Cards */}
            {allBookmakers.map((bookmaker, idx) => {
              const sportsbookInfo = getSportsbookInfo(bookmaker.bookmaker_key || bookmaker.bookmaker);
              return (
                <SportsbookCard
                  key={`${bookmaker.bookmaker_key || bookmaker.bookmaker}-card-${idx}`}
                  bookmaker={bookmaker}
                  bestOverOdds={bestOverOdds}
                  bestUnderOdds={bestUnderOdds}
                  sportsbookInfo={sportsbookInfo}
                />
              );
            })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default PropOddsTable;
