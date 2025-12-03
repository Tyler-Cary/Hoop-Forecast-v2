# 🎨 Sportsbook Logo Setup Instructions

## ✅ What Was Fixed

I've implemented a **centralized sportsbook logo management system** that:

1. **Created `/frontend/src/utils/sportsbookLogos.js`** - Single source of truth for all logo mappings
2. **Updated `PropOddsTable.jsx`** - Now uses the centralized utility functions
3. **Normalized all sportsbook name handling** - Handles variants like "DraftKings", "draftkings", "DRAFT_KINGS", etc.
4. **Added fallback support** - Unknown sportsbooks show a default icon instead of breaking

## 📂 Logo Files Location

All logo files should be placed in:
```
/Applications/Project/frontend/public/images/sportsbooks/
```

## 🎯 Required Logo Files

### HIGH PRIORITY (Most Common Sportsbooks)
These are the sportsbooks most likely to appear in The Odds API:

```
✅ MUST HAVE:
- draftkings.png
- fanduel.png
- betmgm.png
- caesars.png
- bovada.png
- bet365.png
```

### MEDIUM PRIORITY (Common Regional/DFS Books)
```
🔶 RECOMMENDED:
- prizepicks.png
- underdog.png
- hardrock.png
- espnbet.png
- fanatics.png
- betrivers.png
- betonline.png
- williamhill.png
- pointsbet.png
- barstool.png
```

### LOW PRIORITY (Less Common)
```
⚪ OPTIONAL:
- superbook.png
- unibet.png
- wynnbet.png
- twinspires.png
- pinnacle.png
- betway.png
- mybookie.png
- lowvig.png
- betano.png
- bwin.png
- parlayplay.png
- sleeper.png
```

### SPECIAL FILES
```
🎨 SYSTEM:
- default.png (fallback for unknown sportsbooks)
- consensus.png (for calculated/average lines)
```

## 📐 Logo Specifications

### Format Requirements:
- **File Type**: PNG (with transparent background)
- **Size**: 200x200px (or similar square aspect ratio)
- **Quality**: High resolution for retina displays (2x recommended)
- **Background**: Transparent (important for dark theme UI)
- **Naming**: Lowercase, no spaces (e.g., `draftkings.png` NOT `DraftKings.png`)

### Design Guidelines:
- Use official brand logos whenever possible
- Ensure good contrast on dark backgrounds
- Square or circular logos work best
- Avoid logos with white backgrounds (use transparency)

## 🔍 Where to Get Logos

1. **Official Websites**:
   - Check sportsbook press kits or media pages
   - Download from "About" or "Brand Assets" sections

2. **Wikipedia**:
   - Many sportsbook logos available on their Wikipedia pages
   - Usually high quality and already transparent

3. **Screen Capture**:
   - As a last resort, screenshot from their mobile app
   - Use tools like Photoshop to remove backgrounds

4. **Logo Databases**:
   - Brands of the World (brandsoftheworld.com)
   - Wikimedia Commons
   - LogoDownload.org

## ⚙️ How the System Works

### Name Normalization:
The system automatically handles these variants:
```javascript
"DraftKings" → "draftkings"
"DRAFT_KINGS" → "draftkings"
"draft_kings" → "draftkings"
"Draft-Kings" → "draftkings"
```

### Logo Lookup:
```javascript
import { getSportsbookLogo } from '../utils/sportsbookLogos';

// Works with any format
const logo = getSportsbookLogo("DraftKings");
// Returns: "/images/sportsbooks/draftkings.png"
```

### Fallback Behavior:
If a logo file is missing:
1. System tries exact match
2. Then tries partial match (handles variants)
3. Falls back to `/images/sportsbooks/default.png`
4. Logs a warning in the console

## 🚀 Testing the System

### Check What Sportsbooks Are in Your Data:
1. Open browser console
2. Load a player page
3. Look for warnings like:
   ```
   ⚠️ No logo found for sportsbook: "WilliamHill_US" (normalized: "williamhillus")
   ```
4. Add that logo file to fix the warning

### Verify Logos Display Correctly:
1. Navigate to a player's Prop Odds section
2. Check filter buttons at the top - should show logos
3. Check BEST ODDS cards - should show small logos in corner
4. If logo is missing, a default icon appears (not blank/broken)

## 📝 Adding a New Sportsbook

If The Odds API adds a new sportsbook:

1. **Add to logo map** in `/frontend/src/utils/sportsbookLogos.js`:
   ```javascript
   const SPORTSBOOK_LOGO_MAP = {
     // ... existing entries ...
     'newsportsbook': '/images/sportsbooks/newsportsbook.png',
   };
   ```

2. **Add display name** (optional):
   ```javascript
   const SPORTSBOOK_DISPLAY_NAMES = {
     // ... existing entries ...
     'newsportsbook': 'New Sportsbook',
   };
   ```

3. **Add logo file**:
   - Place `newsportsbook.png` in `/frontend/public/images/sportsbooks/`

4. **Test**:
   - Clear browser cache
   - Reload player page
   - Verify logo appears

## 🐛 Troubleshooting

### Problem: Logos not appearing
- Check file exists in `/frontend/public/images/sportsbooks/`
- Verify filename matches exactly (case-sensitive on some systems)
- Clear browser cache and hard reload (Cmd+Shift+R / Ctrl+Shift+R)
- Check browser console for 404 errors

### Problem: Wrong logo showing
- Check normalization in `sportsbookLogos.js`
- Verify the sportsbook name from API matches your mapping
- Add console.log in `getSportsbookLogo()` to debug

### Problem: Logo looks bad/blurry
- Use higher resolution image (400x400 or larger)
- Ensure transparent background
- Save as PNG (not JPG)

## 📊 Current Status

### Files Created:
✅ `/frontend/src/utils/sportsbookLogos.js` - Centralized utility
✅ `/frontend/public/images/sportsbooks/README.md` - Documentation
✅ `/frontend/public/images/sportsbooks/default.png` - Fallback logo

### Files Updated:
✅ `/frontend/src/components/PropOddsTable.jsx` - Uses new utility

### Next Steps:
🔲 Download and add actual sportsbook logo files (see list above)
🔲 Test with real data to identify which logos are most needed
🔲 Replace placeholder `default.png` with a better fallback icon

## 🎨 Placeholder Logo Creation

Until you add real logos, you can create simple placeholders:

### Option 1: Text-Based SVG
Create an SVG with the sportsbook initials (e.g., "DK" for DraftKings)

### Option 2: Colored Square
Use brand colors as a temporary placeholder

### Option 3: Generic Icon
Use a generic "sportsbook" or "betting" icon

The system will work with whatever you provide - it's designed to be flexible!

---

**Need Help?** Check the console for warnings about missing logos, they'll tell you exactly which files to add.

