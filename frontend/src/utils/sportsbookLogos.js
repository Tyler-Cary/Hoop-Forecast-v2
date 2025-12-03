/**
 * Centralized Sportsbook Logo Mapping
 * 
 * This utility provides a single source of truth for all sportsbook logos.
 * It handles name normalization and provides fallback support.
 */

// Comprehensive sportsbook logo mapping
// Keys are normalized (lowercase, no spaces/underscores/special chars)
const SPORTSBOOK_LOGO_MAP = {
  // Major US Sportsbooks
  'draftkings': '/images/sportsbooks/draftkings.png',
  'fanduel': '/images/sportsbooks/fanduel.png',
  'betmgm': '/images/sportsbooks/betmgm.png',
  'caesars': '/images/sportsbooks/caesars.png',
  'bet365': '/images/sportsbooks/bet365.png',
  
  // Additional US Books
  'bovada': '/images/sportsbooks/bovada.png',
  'betrivers': '/images/sportsbooks/betrivers.png',
  'betonlineag': '/images/sportsbooks/betonline.png',
  'betonline': '/images/sportsbooks/betonline.png',
  'williamhillus': '/images/sportsbooks/williamhill.png',
  'williamhill': '/images/sportsbooks/williamhill.png',
  'pointsbet': '/images/sportsbooks/pointsbet.png',
  'superbook': '/images/sportsbooks/superbook.png',
  'barstool': '/images/sportsbooks/barstool.png',
  'unibet': '/images/sportsbooks/unibet.png',
  'wynnbet': '/images/sportsbooks/wynnbet.png',
  'twinspires': '/images/sportsbooks/twinspires.png',
  
  // New Entrants
  'hardrock': '/images/sportsbooks/hardrock.png',
  'hardrockbet': '/images/sportsbooks/hardrock.png',
  'espnbet': '/images/sportsbooks/espnbet.png',
  'fanatics': '/images/sportsbooks/fanatics.png',
  
  // DFS/Props-Focused
  'prizepicks': '/images/sportsbooks/prizepicks.png',
  'underdog': '/images/sportsbooks/underdog.png',
  'underdogfantasy': '/images/sportsbooks/underdog.png',
  'parlayplay': '/images/sportsbooks/parlayplay.png',
  'sleeper': '/images/sportsbooks/sleeper.png',
  
  // International
  'pinnacle': '/images/sportsbooks/pinnacle.png',
  'betway': '/images/sportsbooks/betway.png',
  'mybookieag': '/images/sportsbooks/mybookie.png',
  'mybookie': '/images/sportsbooks/mybookie.png',
  'lowvig': '/images/sportsbooks/lowvig.png',
  'betano': '/images/sportsbooks/betano.png',
  'bwin': '/images/sportsbooks/bwin.png',
  
  // Calculated/Consensus
  'calculated': '/images/sportsbooks/consensus.png',
  'consensus': '/images/sportsbooks/consensus.png',
  'average': '/images/sportsbooks/consensus.png'
};

// Display names mapping (for consistency)
const SPORTSBOOK_DISPLAY_NAMES = {
  'draftkings': 'DraftKings',
  'fanduel': 'FanDuel',
  'betmgm': 'BetMGM',
  'caesars': 'Caesars',
  'bet365': 'Bet365',
  'bovada': 'Bovada',
  'betrivers': 'BetRivers',
  'betonlineag': 'BetOnline',
  'betonline': 'BetOnline',
  'williamhillus': 'William Hill',
  'williamhill': 'William Hill',
  'pointsbet': 'PointsBet',
  'superbook': 'SuperBook',
  'barstool': 'Barstool',
  'unibet': 'Unibet',
  'wynnbet': 'WynnBet',
  'twinspires': 'TwinSpires',
  'hardrock': 'Hard Rock',
  'hardrockbet': 'Hard Rock',
  'espnbet': 'ESPN BET',
  'fanatics': 'Fanatics',
  'prizepicks': 'PrizePicks',
  'underdog': 'Underdog',
  'underdogfantasy': 'Underdog',
  'parlayplay': 'ParlayPlay',
  'sleeper': 'Sleeper',
  'pinnacle': 'Pinnacle',
  'betway': 'Betway',
  'mybookieag': 'MyBookie',
  'mybookie': 'MyBookie',
  'lowvig': 'LowVig',
  'betano': 'Betano',
  'bwin': 'Bwin',
  'calculated': 'Consensus',
  'consensus': 'Consensus',
  'average': 'Average'
};

// Default fallback logo
const DEFAULT_LOGO = '/images/sportsbooks/default.png';

/**
 * Normalize sportsbook name for lookup
 * Removes spaces, underscores, dots, and converts to lowercase
 * 
 * @param {string} name - Raw sportsbook name from API
 * @returns {string} Normalized key
 */
export function normalizeSportsbookName(name) {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .toLowerCase()
    .replace(/\s+/g, '')           // Remove all spaces
    .replace(/_/g, '')             // Remove underscores
    .replace(/\./g, '')            // Remove dots
    .replace(/-/g, '')             // Remove hyphens
    .replace(/'/g, '')             // Remove apostrophes
    .trim();
}

/**
 * Get sportsbook logo path
 * 
 * @param {string} sportsbookName - Sportsbook name (any format)
 * @returns {string} Logo image path
 */
export function getSportsbookLogo(sportsbookName) {
  if (!sportsbookName) return DEFAULT_LOGO;
  
  const normalized = normalizeSportsbookName(sportsbookName);
  
  // Direct match
  if (SPORTSBOOK_LOGO_MAP[normalized]) {
    return SPORTSBOOK_LOGO_MAP[normalized];
  }
  
  // Partial match (for variants)
  for (const [key, logo] of Object.entries(SPORTSBOOK_LOGO_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return logo;
    }
  }
  
  // Fallback to default
  console.warn(`⚠️ No logo found for sportsbook: "${sportsbookName}" (normalized: "${normalized}")`);
  return DEFAULT_LOGO;
}

/**
 * Get sportsbook display name
 * 
 * @param {string} sportsbookName - Sportsbook name (any format)
 * @returns {string} Formatted display name
 */
export function getSportsbookDisplayName(sportsbookName) {
  if (!sportsbookName) return 'Unknown';
  
  const normalized = normalizeSportsbookName(sportsbookName);
  
  // Direct match
  if (SPORTSBOOK_DISPLAY_NAMES[normalized]) {
    return SPORTSBOOK_DISPLAY_NAMES[normalized];
  }
  
  // Partial match
  for (const [key, displayName] of Object.entries(SPORTSBOOK_DISPLAY_NAMES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return displayName;
    }
  }
  
  // Fallback to capitalize first letter of each word
  return sportsbookName
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get complete sportsbook info (logo + display name)
 * 
 * @param {string} sportsbookName - Sportsbook name (any format)
 * @returns {object} { logo: string, displayName: string, normalized: string }
 */
export function getSportsbookInfo(sportsbookName) {
  return {
    logo: getSportsbookLogo(sportsbookName),
    displayName: getSportsbookDisplayName(sportsbookName),
    normalized: normalizeSportsbookName(sportsbookName)
  };
}

/**
 * Get list of all supported sportsbooks (for debugging)
 * 
 * @returns {Array<string>} List of all sportsbook keys
 */
export function getAllSupportedSportsbooks() {
  return Object.keys(SPORTSBOOK_LOGO_MAP).sort();
}

/**
 * Check if logo exists for a sportsbook
 * 
 * @param {string} sportsbookName - Sportsbook name
 * @returns {boolean} True if logo mapping exists
 */
export function hasLogoMapping(sportsbookName) {
  const normalized = normalizeSportsbookName(sportsbookName);
  return SPORTSBOOK_LOGO_MAP.hasOwnProperty(normalized);
}

