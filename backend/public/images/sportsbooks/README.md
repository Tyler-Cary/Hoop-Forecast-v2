# Sportsbook Logos

This is the **CORRECT** location for all sportsbook logo files.

## ✅ Current Logos Available:

- ✅ **betonline.png** - BetOnline
- ✅ **williamhill.png** - William Hill
- ✅ **draftkings.png** - DraftKings
- ✅ **fanduel.png** - FanDuel
- ✅ **betmgm.png** - BetMGM
- ✅ **caesars.png** - Caesars
- ✅ **bovada.png** - Bovada
- ✅ **prizepicks.png** - PrizePicks
- ✅ **underdog.png** / **underdog_fantasy.png** - Underdog
- ✅ **hard_rock.png** / **hard_rock_bet.png** - Hard Rock
- ✅ **espn_bet.png** - ESPN BET
- ✅ **barstool.png** - Barstool
- ✅ **betrivers.png** - BetRivers
- ✅ **pointsbet.png** - PointsBet
- ✅ **unibet.png** - Unibet
- ✅ **wynnbet.png** / **wynn_bet.png** - WynnBet
- ✅ **foxbet.png** - FOX Bet
- ✅ **default.png** - Fallback logo

## 📍 Important:

**All sportsbook logos MUST be placed in this directory:**
```
/Applications/Project/backend/public/images/sportsbooks/
```

**NOT** in `/frontend/public/images/` - those won't work!

## 🎯 Why Backend?

The Vite dev server proxies `/images` requests to the backend server (localhost:5001).
The backend serves static files from `backend/public/images/`.

## 📝 To Add New Logos:

1. Download PNG logo (200x200px, transparent background)
2. Name it lowercase with no spaces (e.g., `bet365.png`)
3. Place in: `/Applications/Project/backend/public/images/sportsbooks/`
4. Update mapping in: `/frontend/src/utils/sportsbookLogos.js` if needed
5. Restart dev servers and hard refresh browser

## ✨ That's It!

The centralized logo system will automatically pick up any logos you add here.

