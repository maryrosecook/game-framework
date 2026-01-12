# Game storage plan (single root: /games)

- Change to storing games in a single root directory: `/data/games`
- Change to serving games from a url path: `/games/<game-slug>`
- add a `.gitignore` that ignores `data/games/*` and explicitly unignores demo names (update when adding demos).
- Move existing demo games to the new root directory.
- Continue to block duplicate game names
- Re-run `npm run manifest:blueprints`.
- Implement lock editing based on a token in the URL (see below)
- Implement share button (see below)
- Implement script to pull games from prod (see below)

## Lightweight edit-vs-play access (token)

- On game create, generate `editKey` (random 24-32 chars) and store it in `game-edit.json` (server-only).
  - Create `game-edit.json` immediately at game creation (not lazily).
  - Keep `game.json` clean so it can be sent to clients without stripping fields.
- Return `editKey` once to the creator; UI navigates to `/<game>?edit=<token>`.
- All write endpoints (save game, blueprint create/rename, image upload/update, game settings) require `editKey`.
- Read endpoints remain public.
- `game-edit.json` must never be sent to clients.
- Read the edit key only from the URL (`?edit=<token>`). If it is missing or invalid, the app is read-only.
- Shared URLs must be play-only and never include `editKey`.

## Share button (toolbar)

- Add a share button to the toolbar (to the right of the restart button)with Ionicons "share-outline" (box + up arrow).
  - If "share-outline" is not available, use the closest Ionicon with the box+arrow visual.
- On click:
  - Copy `window.location.origin + "/" + gameDirectory` to clipboard (no `edit` param).
  - Show a small toast: `Game link copied to clipboard.`

## New local script: `npm run games-pull`

- Add `scripts/games-pull.sh` (or `.ts`) and `package.json` script:
  - `rsync -av do:/home/maryrosecook/node-sites/game-framework/data/games/ ./data/games/`
- This merges prod games into local `./data/games` without deleting local files.

## Validation checklist

- `npm run typescript`
