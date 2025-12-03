import { downloadSportsbookLogo } from '../services/sportsbookLogoStorageService.js';

/**
 * Script to download all sportsbook logos
 * Run this once to populate the logos directory
 */

const SPORTSBOOKS = [
  // Using direct PNG/JPG sources and favicons
  { name: 'DraftKings', url: 'https://www.draftkings.com/favicon-192x192.png' },
  { name: 'FanDuel', url: 'https://www.fanduel.com/favicon-192x192.png' },
  { name: 'BetMGM', url: 'https://sports.betmgm.com/favicon-192x192.png' },
  { name: 'Caesars', url: 'https://www.caesars.com/favicon-192x192.png' },
  { name: 'PointsBet', url: 'https://www.pointsbet.com/favicon-192x192.png' },
  { name: 'Barstool', url: 'https://www.barstoolsportsbook.com/favicon-192x192.png' },
  { name: 'BetRivers', url: 'https://www.betrivers.com/favicon-192x192.png' },
  { name: 'WynnBet', url: 'https://www.wynnbet.com/favicon-192x192.png' },
  { name: 'Unibet', url: 'https://www.unibet.com/favicon-192x192.png' },
  { name: 'FoxBet', url: 'https://www.foxbet.com/favicon-192x192.png' },
  { name: 'Hard Rock', url: 'https://www.hardrockbet.com/favicon-192x192.png' },
  { name: 'ESPN BET', url: 'https://www.espnbet.com/favicon-192x192.png' },
  { name: 'PrizePicks', url: 'https://www.prizepicks.com/favicon-192x192.png' },
  { name: 'Underdog', url: 'https://www.underdog.com/favicon-192x192.png' },
  { name: 'SugarHouse', url: 'https://www.riverscasino.com/favicon-192x192.png' },
  // Alternative names/variations
  { name: 'Wynn_Bet', url: 'https://www.wynnbet.com/favicon-192x192.png' },
  { name: 'Hard_Rock', url: 'https://www.hardrockbet.com/favicon-192x192.png' },
  { name: 'Hard_Rock_Bet', url: 'https://www.hardrockbet.com/favicon-192x192.png' },
  { name: 'ESPN_BET', url: 'https://www.espnbet.com/favicon-192x192.png' },
  { name: 'Underdog_Fantasy', url: 'https://www.underdog.com/favicon-192x192.png' }
];

async function downloadAllLogos() {
  console.log('📥 Starting to download sportsbook logos...\n');
  
  for (const sportsbook of SPORTSBOOKS) {
    try {
      await downloadSportsbookLogo(sportsbook.name, sportsbook.url);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`❌ Failed to download ${sportsbook.name}: ${error.message}`);
    }
  }
  
  console.log('\n✅ Logo download process complete!');
}

// Run the script
downloadAllLogos().catch(console.error);

export { downloadAllLogos };

