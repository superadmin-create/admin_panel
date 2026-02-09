# AI Viva - Teacher Admin Panel

A modern admin panel for teachers to manage AI viva examinations, built with Next.js 14, React, and Tailwind CSS.

## Features

- **Dashboard**: Overview of viva statistics, recent results, and subject performance
- **Student Management**: View, search, and filter all enrolled students
- **Viva Results**: Complete record of all examinations with filtering and export options
- **Subject Management**: Configure subjects and view performance analytics
- **Settings**: Manage profile, notifications, security, and preferences

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components inspired by shadcn/ui
- **Form Handling**: React Hook Form with Zod validation
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the admin_panel directory:
   ```bash
   cd admin_panel
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3001](http://localhost:3001) in your browser.

## Project Structure

```
admin_panel/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx        # Dashboard layout with sidebar
│   │   ├── page.tsx          # Main dashboard
│   │   ├── students/
│   │   │   └── page.tsx      # Student management
│   │   ├── results/
│   │   │   └── page.tsx      # Viva results
│   │   ├── subjects/
│   │   │   └── page.tsx      # Subject management
│   │   └── settings/
│   │       └── page.tsx      # Settings page
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Login page
├── components/
│   ├── layout/
│   │   ├── Header.tsx        # Page header
│   │   └── Sidebar.tsx       # Navigation sidebar
│   └── ui/
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── form.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── table.tsx
│       └── tabs.tsx
├── lib/
│   └── utils.ts              # Utility functions
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Pages

### Login (`/`)
Teacher authentication page with email and password login.

### Dashboard (`/dashboard`)
- Statistics cards showing total students, completed vivas, average scores
- Recent viva results list
- Subject performance overview
- Quick action buttons

### Students (`/dashboard/students`)
- Searchable student directory
- Filter by batch, subject, and status
- Student status indicators (Active, At Risk, Pending)
- Quick actions for each student

### Results (`/dashboard/results`)
- Tabbed view for all/passed/failed results
- Detailed viva information including duration, questions asked
- AI evaluation summaries
- Export functionality

### Subjects (`/dashboard/subjects`)
- Subject list with performance metrics
- Individual subject cards with completion progress
- Add/edit subject functionality

### Settings (`/dashboard/settings`)
- Profile management
- Notification preferences
- Security settings (password change)
- Application preferences (theme, language, timezone)

## Customization

### Theming

The color scheme is defined using CSS variables in `app/globals.css`. The primary color is a purple accent which can be modified by changing the `--primary` variable.

### Adding New Pages

1. Create a new folder under `app/dashboard/`
2. Add a `page.tsx` file
3. Add the route to the sidebar in `components/layout/Sidebar.tsx`

## License

This project is part of the AI Viva examination system.


