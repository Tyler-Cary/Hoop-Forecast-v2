# 🔍 Logo Display Troubleshooting

## Files Confirmed Present:
✅ `/frontend/public/images/sportsbooks/betonline.png` (5.6KB)
✅ `/frontend/public/images/sportsbooks/williamhill.png` (498KB)

## Mapping Confirmed in Code:
✅ `sportsbookLogos.js` has correct paths:
- `'betonline'` → `/images/sportsbooks/betonline.png`
- `'williamhill'` → `/images/sportsbooks/williamhill.png`

## Troubleshooting Steps:

### 1. Hard Refresh Browser
```
Mac: Cmd + Shift + R
Windows: Ctrl + Shift + F5
```

### 2. Restart Dev Server
```bash
# Stop current server (Ctrl+C)
cd /Applications/Project/frontend
npm run dev
```

### 3. Clear Browser Cache
- Open DevTools (F12)
- Right-click refresh button
- Select "Empty Cache and Hard Reload"

### 4. Check Browser Console
Open DevTools (F12) → Console tab and look for:
- ❌ 404 errors for image files
- ⚠️ Warnings about missing logos
- Any errors loading `/images/sportsbooks/`

### 5. Check Network Tab
- Open DevTools (F12) → Network tab
- Filter by "Img"
- Reload page
- Look for `betonline.png` and `williamhill.png`
- Status should be 200 (not 404)

### 6. Test Direct Image Access
Try accessing directly in browser:
```
http://localhost:5173/images/sportsbooks/betonline.png
http://localhost:5173/images/sportsbooks/williamhill.png
```
(Replace port if different)

### 7. Check Component is Using New Utility
In DevTools Console, run:
```javascript
import { getSportsbookLogo } from './src/utils/sportsbookLogos.js';
console.log(getSportsbookLogo('betonline'));
console.log(getSportsbookLogo('williamhill'));
```

Should output:
```
/images/sportsbooks/betonline.png
/images/sportsbooks/williamhill.png
```

## Common Issues:

### Issue 1: Old Build Cached
**Solution**: Delete `dist` folder and rebuild
```bash
cd /Applications/Project/frontend
rm -rf dist
npm run build
npm run dev
```

### Issue 2: Browser Using Cached Version
**Solution**: 
- Open in incognito/private window
- Or clear all browser data for localhost

### Issue 3: Dev Server Needs Restart
**Solution**:
```bash
# Kill the server
pkill -f "vite"
# Restart
cd /Applications/Project/frontend
npm run dev
```

### Issue 4: Wrong Sportsbook Key from API
**Solution**: Check what the API actually returns
- Open browser console
- Look at network requests to `/api/player/compare`
- Check the `bookmaker_key` values
- They might be: "betonline.ag", "williamhill_us", etc.

## Debug: Check API Response

In browser console while on player page:
```javascript
// Check what sportsbook keys are being returned
fetch('/api/player/compare?name=PLAYER_NAME&prop=points')
  .then(r => r.json())
  .then(data => {
    console.log('All bookmakers:', 
      data.props?.points?.all_bookmakers?.map(b => ({
        key: b.bookmaker_key,
        name: b.bookmaker
      }))
    );
  });
```

This will show you the EXACT keys being returned by the API.

## If Still Not Working:

1. Share the browser console output
2. Share the network tab showing image requests
3. Share what sportsbook keys the API is returning
4. Check if the images show when accessed directly via URL

The code is correct - this is likely a caching or server restart issue!

