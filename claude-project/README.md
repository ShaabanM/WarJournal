# War Journal — Claude Project Setup

This folder contains everything you need to set up a **Claude Project** on [claude.ai](https://claude.ai) that can help you write and publish War Journal entries via conversation.

## Quick Setup (5 minutes)

### 1. Create a Claude Project

1. Go to [claude.ai](https://claude.ai)
2. Click **Projects** in the sidebar → **Create Project**
3. Name it: **War Journal**

### 2. Set the Custom Instructions

1. In the project, click **Edit Project** → **Custom Instructions**
2. Copy the entire contents of [`system-prompt.md`](./system-prompt.md) and paste it in
3. Save

### 3. Add Your GitHub Token

You have two options:

**Option A — Include in instructions** (convenient but less secure):
Add this line at the very end of the Custom Instructions:
```
The author's GitHub token is: ghp_your_token_here
```

**Option B — Provide per-conversation** (more secure):
Each time you start a new conversation in the project, include your token:
```
My GitHub token for this session is: ghp_xxxx
```

### 4. Start Journaling!

Open a new conversation in the project and say something like:

> "Today I explored the spice souk in Deira. The colors and smells were incredible — saffron, cardamom, frankincense. It felt like stepping back in time. Here's a photo from today."

Claude will:
1. ✍️ Write a polished journal entry from your notes
2. 🔍 Search for relevant news headlines from today
3. 📋 Generate a ready-to-run publish script

---

## How Publishing Works

Since Claude on claude.ai can't directly call APIs, it generates a shell script for you. To publish:

### Option 1: Copy-paste the script
1. Claude generates a bash script
2. Copy it to your terminal
3. Run it — entry is live!

### Option 2: Use the helper script
1. Claude generates an `entry.json` file
2. Save it locally
3. Run:
```bash
export GITHUB_TOKEN="ghp_your_token"
./publish-entry.sh entry.json photo1.jpg photo2.jpg
```

### Option 3: Use the `.env` file
Create `claude-project/.env`:
```
GITHUB_TOKEN=ghp_your_token_here
```
Then just run:
```bash
./publish-entry.sh entry.json photo1.jpg
```

---

## Example Conversation

**You**: Hey, rough day. We had to work from the apartment because there were sirens going off nearby — turned out to be a test but nobody told us. Spent the afternoon watching news and stress-eating shawarma. I'm starting to think this is just normal life now. Mood is like... resigned but oddly okay with it?

**Claude**: *Writes a polished entry, searches for today's news, generates publish script*

**You**: Perfect, but make the title more punchy

**Claude**: *Revises title and regenerates*

**You**: Love it. Also here's a photo from the balcony today [attaches image]

**Claude**: *Updates entry with photo, generates upload + publish commands*

---

## Files in This Folder

| File | Purpose |
|------|---------|
| `system-prompt.md` | Custom instructions to paste into your Claude Project |
| `publish-entry.sh` | Helper script to publish entries from the command line |
| `README.md` | This setup guide |
| `.env` | (You create this) Your GitHub token for the helper script |

---

## Tips

- **Backdating**: Tell Claude "this happened on March 10th" and it will set `manualDate`
- **Mood colors**: Claude knows the palette — just describe how you feel
- **Photos**: Attach them directly in the Claude conversation. Claude will tell you how to upload them
- **News**: Claude will automatically search for relevant headlines. You can ask it to pick a different one
- **Editing existing entries**: Tell Claude which entry to edit and what to change — it will generate an update script
- **Voice notes**: Paste voice-to-text transcripts and Claude will clean them up

## Security Note

⚠️ Your GitHub token gives write access to your repo. Never share it publicly. The `.env` file is gitignored.
