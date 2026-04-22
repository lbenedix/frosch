# Froschmazon

Kleine Single-Page-App mit Affiliate-Link-Generator und verstecktem Frog-Game.

## Struktur

- `index.html` - HTML-Markup der Seite
- `manifest.json` - statisches PWA-Manifest
- `assets/css/app.css` - komplettes Styling
- `assets/js/affiliate.js` - Affiliate-Link-Generator + Theme-Events
- `assets/js/pwa.js` - PWA-Manifest + Install-Button-Logik
- `assets/js/app.js` - Frog-Game-Logik
- `assets/js/multiplayer.js` - Multiplayer-Client (Polling)
- `api/*.php` - Multiplayer-Backend (Raum, State, Swat)
- `scripts/smoke_multiplayer.sh` - kleiner End-to-End Smoke-Test

## Lokal starten

Fuer den Multiplayer brauchst du PHP, damit die `api/*.php` Endpoints laufen:

```bash
cd /Users/vwgb44b/WebstormProjects/froschmazon
php -S 127.0.0.1:8080 -t .
```

Dann im Browser `http://localhost:8080` aufrufen.

## Multiplayer Smoke-Test

```bash
cd /Users/vwgb44b/WebstormProjects/froschmazon
bash scripts/smoke_multiplayer.sh
```

