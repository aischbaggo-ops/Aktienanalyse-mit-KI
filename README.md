# KI Aktienanalyse — Frontend

React + TypeScript + Vite + Tailwind CSS Frontend für die KI-Aktienanalyse. Nutzt Supabase für Auth/Datenbank/Realtime und zwei n8n-Webhooks für Symbol-Suche und Analyse-Anfragen.

## ⚠️ Hinweis zu diesem Build

Auf dieser Maschine ist **kein Node.js/npm installiert**, daher konnten `npm install`, der Dev-Server und der Produktions-Build hier nicht ausgeführt/getestet werden. Der komplette Quellcode ist fertig geschrieben — führe die Schritte unten auf einem Rechner mit Node.js aus, um es zu starten.

## Setup

1. **Node.js installieren** (falls nicht vorhanden): Version 18 oder neuer, von [nodejs.org](https://nodejs.org).

2. **Abhängigkeiten installieren:**

   ```bash
   npm install
   ```

3. **Umgebungsvariablen konfigurieren:** `.env` ist bereits mit Projekt-URL und Webhook-URLs vorausgefüllt. Fehlt noch: der Supabase **anon/publishable Key**.

   Supabase Dashboard → dein Projekt → *Project Settings* → *API Keys* → **„Publishable key"** kopieren (beginnt mit `sb_publishable_` oder `eyJ...`) und in `.env` eintragen:

   ```
   VITE_SUPABASE_ANON_KEY=<dein-key>
   ```

   Niemals den `service_role`-Key hier eintragen — der gehört ausschließlich ins Backend (n8n).

4. **Dev-Server starten:**

   ```bash
   npm run dev
   ```

   Öffnet auf `http://localhost:5173`.

5. **Produktions-Build:**

   ```bash
   npm run build
   ```

## Voraussetzungen auf Supabase-Seite (nicht Teil dieses Frontends)

Diese Tabellen und RLS-Policies müssen im Supabase-Projekt bereits existieren (laut Aufgabenstellung sind sie es):

- `stock_analyses` — für eingeloggte User lesbar (Cache, gemeinsam genutzt)
- `watchlists` — jeder User sieht/bearbeitet nur eigene Zeilen (`user_id = auth.uid()`)
- `request_log` — nur für Admins lesbar
- `profiles` — `id = auth.users.id`, Feld `is_admin`; jeder User darf mind. seine eigene Zeile lesen (die App fragt `is_admin` für den eingeloggten User ab, um Admin-Nav und `/admin/aktivitaet` freizuschalten)
- Realtime muss für `stock_analyses` aktiviert sein (Database → Replication), damit `/analyse/:ticker` den Status-Übergang `pending/running → done` live mitbekommt.

Falls `/admin/aktivitaet` mit einem Fehler statt Daten lädt, ist meist eine fehlende oder zu strikte RLS-Policy auf `request_log` die Ursache.

## Projektstruktur

```
src/
  lib/            Supabase-Client, Webhook-Aufrufe, Score-Farblogik
  types/          TypeScript-Typen für die DB-Tabellen
  context/        AuthContext (Session, isAdmin)
  hooks/          useDebounce
  components/     Layout, Route-Guards, ScoreGauge, SubScoreBar, CriteriaGroup, CrisisChart, SymbolSearch, ScoreBadge
  pages/          LoginPage, DashboardPage, AnalysePage, AdminPage
```

## Deployment (Vercel oder Netlify)

Beide sind für dieses Projekt kostenlos und deployen automatisch bei jedem Push.

### Vercel

1. Repo auf GitHub pushen.
2. Auf [vercel.com](https://vercel.com) → *Add New Project* → Repo auswählen.
3. Framework Preset: **Vite** (wird meist automatisch erkannt).
4. Environment Variables eintragen (identisch zu `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ANALYSE_WEBHOOK_URL`
   - `VITE_SYMBOL_SEARCH_WEBHOOK_URL`
5. Deploy.

### Netlify

1. Repo auf GitHub pushen.
2. Auf [netlify.com](https://netlify.com) → *Add new site* → *Import an existing project*.
3. Build command: `npm run build`, Publish directory: `dist`.
4. Environment Variables identisch zu oben unter *Site settings → Environment variables* eintragen.
5. Deploy.

**Wichtig:** Der n8n-Webhook läuft aktuell über eine `ngrok-free.dev`-URL. Diese Tunnel-URLs ändern sich bei jedem Neustart von ngrok (außer bei einem reservierten/statischen Domain-Plan). Falls sich die Webhook-URL ändert, muss sie sowohl lokal in `.env` als auch in den Environment Variables von Vercel/Netlify aktualisiert werden.
