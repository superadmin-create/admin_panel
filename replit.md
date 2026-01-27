# AI Viva Admin Panel (Teacher Portal)

## Overview
The teacher-facing admin panel for AI Viva. This works alongside a separate student-facing app (ai-viva). This is a TypeScript-based web application using:
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Radix UI components
- React Hook Form with Zod validation

## Project Structure
```
/app           - Next.js app router pages and API routes
  /api         - Backend API endpoints
  /dashboard   - Dashboard pages
/components    - Reusable UI components  
/lib           - Utility functions and shared code
  /api         - Google Sheets integration
  db.ts        - PostgreSQL database utilities
/public        - Static assets
/scripts       - Build/utility scripts
```

## Development
- Run: `npm run dev` (starts on port 5000)
- Build: `npm run build`
- Production: `npm run start`

## Configuration
- Port: 5000 (configured for Replit)
- Host: 0.0.0.0 (allows external access)

## Data Storage
The app uses dual storage for data persistence:

### Google Sheets (Primary Read Source)
- Teacher credentials: Sheet ID `1or1TVnD6Py-gZ1dSP25CJjwufDeQ_Pi-s1tKls3lq_0`
- Student data (subjects, topics, viva results): Sheet ID `1dPderiJxJl534xNnzHVVqye9VSx3zZY3ZEgO3vjqpFY`
- Uses Replit's Google Sheets OAuth connector for authentication

### PostgreSQL Database (Secondary Storage)
All writes are saved to both Google Sheets AND the PostgreSQL database.

Database tables:
- `teachers` - Teacher login credentials
- `subjects` - Subject names and codes
- `topics` - Topics associated with subjects
- `viva_results` - Student viva examination results
- `viva_questions` - Generated viva questions

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - For AI-powered viva question generation
- Google Sheets OAuth handled via Replit connector

## Recent Changes
- 2026-01-27: Added PostgreSQL database with dual-save functionality
- 2026-01-27: Migrated Google Sheets from service account to OAuth2 connector
- 2026-01-27: Updated all API routes to save data to both Sheets and database
