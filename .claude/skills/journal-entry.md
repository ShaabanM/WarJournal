# War Journal — Entry Management Skill

You can create, update, and manage journal entries for the War Journal app. The app stores entries as a JSON file in a GitHub repository, published via the GitHub Contents API.

## Required Configuration

You need these values (ask the user if not provided):
- `GITHUB_TOKEN` — A GitHub personal access token with `repo` scope
- `GITHUB_OWNER` — GitHub username (e.g. `shaabanm`)
- `GITHUB_REPO` — Repository name (e.g. `WarJournal`)

## Entry Data Format

Each entry in the `data/entries.json` file follows this TypeScript interface:

```typescript
interface JournalEntry {
  id: string;              // UUID — use crypto.randomUUID() or generate one
  timestamp: string;       // ISO 8601 — when the entry was created
  location: {
    lat: number;           // Latitude
    lng: number;           // Longitude
    placeName?: string;    // Short display name (e.g. "Sultanahmet, Istanbul")
    city?: string;         // City name
    country?: string;      // Country name
  };
  title: string;           // Entry title
  content: string;         // Journal text (supports newlines)
  mood?: string;           // Free text mood (e.g. "grateful", "anxious but hopeful")
  photos: [];              // Empty array (photos can't be added via API)
  tags: string[];          // Tags like ["travel", "border-crossing"]
  isPublished: boolean;    // Must be `true` for the entry to appear on the site
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  newsHeadline?: string;   // Summary of world news that day
  manualDate?: string;     // ISO 8601 — if the entry is for a past date
}
```

## How to Create an Entry

### Step 1: Get the current entries file

```bash
# Fetch current entries
curl -s "https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/data/entries.json" | jq .
```

If the file doesn't exist yet, start with:
```json
{ "entries": [], "exportedAt": "", "totalEntries": 0 }
```

### Step 2: Geocode the location (if only a city name is provided)

Use the Nominatim API to get coordinates:
```bash
curl -s "https://nominatim.openstreetmap.org/search?q=Istanbul,Turkey&format=json&limit=1&addressdetails=1" | jq '.[0] | {lat: .lat, lon: .lon, city: .address.city, country: .address.country}'
```

### Step 3: Build the entry object

Generate a new entry with all required fields. Example:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-03-15T14:30:00.000Z",
  "location": {
    "lat": 41.0082,
    "lng": 28.9784,
    "placeName": "Sultanahmet, Istanbul",
    "city": "Istanbul",
    "country": "Turkey"
  },
  "title": "Crossing into Turkey",
  "content": "After days of uncertainty, we finally made it across the border...",
  "mood": "relieved but exhausted",
  "photos": [],
  "tags": ["border-crossing", "turkey"],
  "isPublished": true,
  "createdAt": "2025-03-15T14:30:00.000Z",
  "updatedAt": "2025-03-15T14:30:00.000Z",
  "newsHeadline": "UN Security Council holds emergency session on conflict escalation",
  "manualDate": null
}
```

### Step 4: Get the existing file SHA

```bash
SHA=$(curl -s -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/entries.json" \
  | jq -r '.sha')
```

### Step 5: Push the updated file

Append the new entry to the entries array, update `exportedAt` and `totalEntries`, then:

```bash
# Base64 encode the full JSON
CONTENT=$(echo '{ "entries": [...], "exportedAt": "...", "totalEntries": N }' | base64 -w 0)

curl -X PUT \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/entries.json" \
  -d "{
    \"message\": \"Add journal entry — $(date +%Y-%m-%d)\",
    \"content\": \"${CONTENT}\",
    \"sha\": \"${SHA}\",
    \"branch\": \"main\"
  }"
```

## Workflow Examples

### "Add a journal entry for today"
1. Ask the user for: location, what happened, how they're feeling
2. Use Claude's knowledge to summarize today's news headlines
3. Geocode the city if coordinates not provided
4. Create the entry and push to GitHub

### "Backfill an entry for March 10th in Cairo"
1. Set `manualDate` to `2025-03-10T12:00:00.000Z`
2. Set `timestamp` to now (when it was actually written)
3. Geocode "Cairo, Egypt" for coordinates
4. Push to GitHub

### "Summarize today's news and add it to my latest entry"
1. Fetch current entries
2. Find the latest entry by timestamp
3. Update its `newsHeadline` field
4. Push the updated entries back

## Important Notes

- Always set `isPublished: true` so the entry appears on the live site
- The `photos` array should always be `[]` when creating via API (photos require base64 data URLs)
- The site auto-deploys via GitHub Actions after a push to `main`
- Entries are sorted by `manualDate || timestamp` on the site — oldest first
- The mood field supports any free text; the app does client-side sentiment analysis for color coding
- Always include `sha` when updating an existing file to avoid conflicts
