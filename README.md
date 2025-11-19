# TennisLife PWA

A Progressive Web Application for tennis team management and coordination.

## Features

### Home (Tennis Life Hub)
- Next Playing hero card with match details
- Status list of upcoming matches
- Visual indicators: In Lineup (green), Off (gray), Pending (yellow)

### Teams (Captain Engine)
- **Import Schedule**: Paste CSV or TennisRecord data
- **Roster Builder**: Add players manually or via CSV
- **Availability System**: Mini-grid for player responses
- **Lineup Builder**: Drag-and-drop with validation
- **Lineup Wizard™**: Auto-generate optimal pairings
- **Warm-Up Wizard™**: Track warm-up court status
- **Match Day Checklist™**: 14d/10d/7d/4d task timeline

### Play (Phase 2)
- Find a Partner
- Find a Fourth
- Find Opponents

### Rules (Rules Guru AI)
- Chat interface for tennis rules questions
- Quick rule buttons
- Powered by OpenAI GPT-4

### Profile
- User profile management
- Master availability defaults
- Court reservations

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Components**: shadcn/ui, Lucide React icons
- **Backend**: Supabase (Auth, Database, Realtime, Edge Functions)
- **Email**: Resend
- **AI**: OpenAI GPT-4
- **PWA**: next-pwa

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm or npm
- Supabase account
- Resend account (for emails)
- OpenAI API key (for Rules Guru)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tennislife-pwa
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `OPENAI_API_KEY`

4. Set up the database:
```bash
# Run the SQL schema in Supabase Dashboard
# or use Supabase CLI
supabase db push
```

5. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### PWA Icons

Generate PWA icons and place them in `/public/icons/`:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

Use [Real Favicon Generator](https://realfavicongenerator.net/) for easy generation.

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Supabase Edge Functions

Deploy edge functions:
```bash
supabase functions deploy lineup-wizard
supabase functions deploy send-email
```

## Project Structure

```
src/
├── app/
│   ├── (app)/           # App routes (with bottom nav)
│   │   ├── home/
│   │   ├── teams/
│   │   ├── play/
│   │   ├── rules/
│   │   └── profile/
│   ├── api/             # API routes
│   └── auth/            # Auth pages
├── components/
│   ├── layout/          # Navigation components
│   ├── teams/           # Team-specific components
│   └── ui/              # shadcn/ui components
├── lib/
│   ├── supabase/        # Supabase clients
│   └── utils.ts         # Utility functions
├── services/
│   └── EmailService.ts  # Email templates
├── hooks/               # Custom hooks
└── types/               # TypeScript types
```

## Email Templates

The app includes three email templates:

1. **Auto-Welcome Email**: Sent to opponent captain with match details
2. **Lineup Playing Email**: Sent to players in the lineup
3. **Lineup Bench Email**: Sent to players not in the lineup

## MVP Deadline

Hard Launch: December 31, 2024

## License

MIT
