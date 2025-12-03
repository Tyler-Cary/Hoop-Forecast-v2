/**
 * Service to map between full team names and abbreviations
 * Used to convert Odds API full team names to NBA abbreviations
 */

const TEAM_NAME_TO_ABBREV = {
  // Full team names from Odds API
  'atlanta hawks': 'ATL',
  'boston celtics': 'BOS',
  'brooklyn nets': 'BKN',
  'charlotte hornets': 'CHA',
  'chicago bulls': 'CHI',
  'cleveland cavaliers': 'CLE',
  'dallas mavericks': 'DAL',
  'denver nuggets': 'DEN',
  'detroit pistons': 'DET',
  'golden state warriors': 'GSW',
  'houston rockets': 'HOU',
  'indiana pacers': 'IND',
  'los angeles clippers': 'LAC',
  'los angeles lakers': 'LAL',
  'memphis grizzlies': 'MEM',
  'miami heat': 'MIA',
  'milwaukee bucks': 'MIL',
  'minnesota timberwolves': 'MIN',
  'new orleans pelicans': 'NOP',
  'new york knicks': 'NYK',
  'oklahoma city thunder': 'OKC',
  'orlando magic': 'ORL',
  'philadelphia 76ers': 'PHI',
  'phoenix suns': 'PHX',
  'portland trail blazers': 'POR',
  'sacramento kings': 'SAC',
  'san antonio spurs': 'SAS',
  'toronto raptors': 'TOR',
  'utah jazz': 'UTA',
  'washington wizards': 'WAS'
};

/**
 * Get team abbreviation from full team name
 * @param {string} fullName - Full team name (e.g., "Washington Wizards")
 * @returns {string|null} Team abbreviation (e.g., "WAS") or null if not found
 */
export function getTeamAbbrevFromFullName(fullName) {
  if (!fullName) return null;
  
  const normalized = fullName.toLowerCase().trim();
  return TEAM_NAME_TO_ABBREV[normalized] || null;
}

/**
 * Check if a full team name matches a given abbreviation
 * @param {string} fullName - Full team name
 * @param {string} abbrev - Team abbreviation to check
 * @returns {boolean} True if they match
 */
export function teamNameMatchesAbbrev(fullName, abbrev) {
  if (!fullName || !abbrev) return false;
  
  const normalized = fullName.toLowerCase().trim();
  const matchedAbbrev = TEAM_NAME_TO_ABBREV[normalized];
  
  return matchedAbbrev === abbrev.toUpperCase();
}

export default {
  getTeamAbbrevFromFullName,
  teamNameMatchesAbbrev
};

