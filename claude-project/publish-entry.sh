#!/bin/bash
# ============================================================================
# War Journal — Publish Entry Helper
# ============================================================================
# Usage:
#   ./publish-entry.sh <entry.json> [photo1.jpg photo2.jpg ...]
#
# Prerequisites:
#   - Set GITHUB_TOKEN environment variable (or create a .env file)
#   - jq installed: brew install jq
#   - python3 available
#
# This script:
#   1. Uploads any provided photos to the GitHub repo
#   2. Fetches the current entries.json
#   3. Appends the new entry (with photo remoteUrls updated)
#   4. Commits the updated entries.json
# ============================================================================

set -euo pipefail

# Load .env file if it exists
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Config
OWNER="ShaabanM"
REPO="WarJournal"
BRANCH="main"
API="https://api.github.com/repos/$OWNER/$REPO"

# Validate
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "❌ GITHUB_TOKEN not set. Export it or add it to claude-project/.env"
  echo "   echo 'GITHUB_TOKEN=ghp_xxxx' > claude-project/.env"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <entry.json> [photo1.jpg photo2.jpg ...]"
  exit 1
fi

ENTRY_FILE="$1"
shift
PHOTOS=("$@")

if [[ ! -f "$ENTRY_FILE" ]]; then
  echo "❌ Entry file not found: $ENTRY_FILE"
  exit 1
fi

ENTRY_JSON=$(cat "$ENTRY_FILE")
ENTRY_ID=$(echo "$ENTRY_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
ENTRY_TITLE=$(echo "$ENTRY_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")

echo "📝 Publishing: \"$ENTRY_TITLE\" (ID: $ENTRY_ID)"

# ---- Upload Photos ----
PHOTO_INDEX=0
for PHOTO_PATH in "${PHOTOS[@]}"; do
  if [[ ! -f "$PHOTO_PATH" ]]; then
    echo "⚠️  Photo not found, skipping: $PHOTO_PATH"
    continue
  fi

  # Get the photo ID from the entry JSON (by index)
  PHOTO_ID=$(echo "$ENTRY_JSON" | python3 -c "
import sys, json
entry = json.load(sys.stdin)
photos = entry.get('photos', [])
if $PHOTO_INDEX < len(photos):
    print(photos[$PHOTO_INDEX]['id'])
else:
    import uuid
    print(str(uuid.uuid4()))
")

  PHOTO_REMOTE_PATH="data/photos/$ENTRY_ID/$PHOTO_ID.jpg"
  PHOTO_BASE64=$(base64 -i "$PHOTO_PATH" | tr -d '\n')

  echo "📸 Uploading photo $((PHOTO_INDEX + 1))/${#PHOTOS[@]}..."

  UPLOAD_RESULT=$(curl -s -X PUT \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "$API/contents/$PHOTO_REMOTE_PATH" \
    -d "{
      \"message\": \"Upload photo $PHOTO_ID\",
      \"content\": \"$PHOTO_BASE64\",
      \"branch\": \"$BRANCH\"
    }")

  if echo "$UPLOAD_RESULT" | python3 -c "import sys,json; json.load(sys.stdin)['content']" &>/dev/null; then
    echo "   ✅ Uploaded: $PHOTO_REMOTE_PATH"
  else
    echo "   ❌ Failed to upload photo. Response:"
    echo "$UPLOAD_RESULT" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" 2>/dev/null || echo "$UPLOAD_RESULT"
  fi

  PHOTO_INDEX=$((PHOTO_INDEX + 1))
done

# ---- Fetch current entries.json ----
echo "📥 Fetching current entries.json..."

RESPONSE=$(curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "$API/contents/data/entries.json")

CURRENT_SHA=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sha',''))")

if [[ -z "$CURRENT_SHA" || "$CURRENT_SHA" == "None" ]]; then
  echo "❌ Could not fetch entries.json SHA. Check your token and repo."
  echo "$RESPONSE" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

# ---- Build new entries.json ----
echo "🔨 Building updated entries.json..."

NEW_CONTENT_B64=$(echo "$RESPONSE" | python3 << 'PYEOF'
import sys, json, base64

response = json.load(sys.stdin)
current_b64 = response["content"].replace("\n", "")
current_json = json.loads(base64.b64decode(current_b64).decode("utf-8"))

# Read the new entry
with open("ENTRY_FILE_PLACEHOLDER", "r") as f:
    new_entry = json.load(f)

# Append
current_json["entries"].append(new_entry)
current_json["exportedAt"] = new_entry["updatedAt"]
current_json["totalEntries"] = len(current_json["entries"])

# Encode
result = json.dumps(current_json, indent=2, ensure_ascii=False)
print(base64.b64encode(result.encode("utf-8")).decode("utf-8"))
PYEOF
)

# Fix the placeholder (sed the actual file path in)
NEW_CONTENT_B64=$(echo "$RESPONSE" | python3 -c "
import sys, json, base64

response = json.load(sys.stdin)
current_b64 = response['content'].replace('\n', '')
current_json = json.loads(base64.b64decode(current_b64).decode('utf-8'))

with open('$ENTRY_FILE', 'r') as f:
    new_entry = json.load(f)

current_json['entries'].append(new_entry)
current_json['exportedAt'] = new_entry['updatedAt']
current_json['totalEntries'] = len(current_json['entries'])

result = json.dumps(current_json, indent=2, ensure_ascii=False)
print(base64.b64encode(result.encode('utf-8')).decode('utf-8'))
")

# ---- PUT updated entries.json ----
echo "📤 Publishing to GitHub..."

PUT_BODY=$(python3 -c "
import json
body = {
    'message': 'Add journal entry — $ENTRY_TITLE',
    'content': '''$NEW_CONTENT_B64''',
    'sha': '$CURRENT_SHA',
    'branch': '$BRANCH'
}
print(json.dumps(body))
")

PUT_RESULT=$(curl -s -X PUT \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "$API/contents/data/entries.json" \
  -d "$PUT_BODY")

if echo "$PUT_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'content' in d" &>/dev/null; then
  NEW_SHA=$(echo "$PUT_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['content']['sha'])")
  echo ""
  echo "✅ Entry published successfully!"
  echo "   Title: $ENTRY_TITLE"
  echo "   SHA: $NEW_SHA"
  echo "   Photos: ${#PHOTOS[@]}"
  echo ""
  echo "🌐 View at: https://moshaaban.com/WarJournal/"
else
  echo "❌ Failed to publish. Response:"
  echo "$PUT_RESULT" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" 2>/dev/null || echo "$PUT_RESULT"
  exit 1
fi
