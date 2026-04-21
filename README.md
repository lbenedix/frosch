# Froschmazon

Kleine Single-Page-App mit Affiliate-Link-Generator und verstecktem Frog-Game.

## Struktur

- `index.html` - HTML-Markup der Seite
- `manifest.json` - statisches PWA-Manifest
- `assets/css/app.css` - komplettes Styling
- `assets/js/affiliate.js` - Affiliate-Link-Generator + Theme-Events
- `assets/js/pwa.js` - PWA-Manifest + Install-Button-Logik
- `assets/js/app.js` - Frog-Game-Logik

## Lokal starten

Da Features wie Clipboard und PWA unter `file://` eingeschraenkt sein koennen, am besten mit lokalem Server starten:

```bash
cd /Users/vwgb44b/WebstormProjects/froschmazon
python3 -m http.server 8080
```

Dann im Browser `http://localhost:8080` aufrufen.

