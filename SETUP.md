# Admin Panel Setup

## Connecting to Viva Results

The admin panel needs to connect to the **same Google Sheet** that `ai-viva-main` uses to store viva results.

### Required Environment Variables

Create a `.env.local` file in the `admin_panel` folder with these variables (copy from your `ai-viva-main/.env` file):

```env
# Google Sheets Configuration - SAME as ai-viva-main
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SHEET_ID=your-google-sheet-id
```

### Where to Find These Values

1. **GOOGLE_SHEET_ID**: Open your Google Sheet URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit` - the ID is in the URL

2. **GOOGLE_CLIENT_EMAIL** and **GOOGLE_PRIVATE_KEY**: From your Google Cloud Console service account JSON file

### How the Connection Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   AI Viva App   │────▶│  Google Sheets   │◀────│  Admin Panel    │
│  (Student App)  │     │  "Viva Results"  │     │ (Teacher Portal)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        │ WRITES results        │ STORES data            │ READS results
        │ after each viva       │ - Timestamp            │ - Dashboard stats
        │ - Score               │ - Student info         │ - Results list
        │ - Transcript          │ - Q&A transcript       │ - Transcripts
        │ - Evaluation          │ - Scores               │ - Analytics
        └───────────────────────┴────────────────────────┘
```

### Google Sheet Structure

The sheet "Viva Results" has these columns:
| Column | Description |
|--------|-------------|
| A | Date & Time |
| B | Student Name |
| C | Email |
| D | Subject |
| E | Topics |
| F | Questions Answered |
| G | Score (out of 100) |
| H | Overall Feedback |
| I | Transcript |
| J | Recording URL |

### After Setup

1. Restart the admin panel: `npm run dev`
2. Go to Dashboard → Viva Results
3. You should see all viva results from Google Sheets
4. Click "View" on any result to see the full Q&A transcript

### Troubleshooting

- **"Sheets configuration not found"**: Environment variables not set
- **"Authentication failed"**: Check GOOGLE_PRIVATE_KEY format (newlines as `\n`)
- **"Permission denied"**: Share the Google Sheet with your service account email


