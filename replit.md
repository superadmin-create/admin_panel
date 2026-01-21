# AI Viva Admin Panel

## Overview
A Next.js admin panel application for the AI Viva teacher portal. This is a TypeScript-based web application using:
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
