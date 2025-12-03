# 📍 Sportsbook Logo Location Guide

## ✅ CORRECT Location:
```
/Applications/Project/backend/public/images/sportsbooks/
```

All sportsbook logo PNG files **MUST** be placed in the **backend** directory, not the frontend!

## ❌ WRONG Location:
```
/Applications/Project/frontend/public/images/sportsbooks/  ← DO NOT USE THIS
```

## 🔧 Why Backend?

The Vite config proxies `/images` requests to the backend server:

```javascript
// vite.config.js
proxy: {
  '/images': {
    target: 'http://localhost:5001',  // Backend server
    changeOrigin: true
  }
}
```

The backend serves static files from `backend/public/images/`:

```javascript
// server.js
app.use('/images', express.static(path.join(__dirname, 'public/images')))
```

## ✅ Current Logos Available:

Located in `/backend/public/images/sportsbooks/`:

- ✅ **betonline.png** (5.6KB)
- ✅ **williamhill.png** (498KB)
- ✅ **draftkings.png**
- ✅ **fanduel.png**
- ✅ **betmgm.png**
- ✅ **caesars.png**
- ✅ **bovada.png**
- ✅ **prizepicks.png**
- ✅ **underdog.png** / **underdog_fantasy.png**
- ✅ **hard_rock.png** / **hard_rock_bet.png**
- ✅ **espn_bet.png**
- ✅ **barstool.png**
- ✅ **betrivers.png**
- ✅ **pointsbet.png**
- ✅ **unibet.png**
- ✅ **wynnbet.png**
- ✅ **foxbet.png**
- ✅ **default.png** (fallback)

## 📝 To Add New Logos:

1. Download PNG logo (200x200px, transparent background)
2. Name it lowercase, no spaces (e.g., `bet365.png`)
3. Place in: `/Applications/Project/backend/public/images/sportsbooks/`
4. Hard refresh browser (Cmd+Shift+R)
5. Logo will automatically appear!

## 🧪 Test Logo Display:

Access directly in browser:
```
http://localhost:5001/images/sportsbooks/betonline.png
http://localhost:5001/images/sportsbooks/williamhill.png
```

If these URLs work, the logos will display in your app!

## 📚 Related Files:

- **Logo Mapping**: `/frontend/src/utils/sportsbookLogos.js`
- **Component Using Logos**: `/frontend/src/components/PropOddsTable.jsx`
- **Backend Static Server**: `/backend/server.js`
- **Vite Proxy Config**: `/frontend/vite.config.js`

---

**Remember**: Always use the **backend** directory for logo files! 🎯

