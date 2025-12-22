# Recurring Events Setup Instructions

## Step 1: Run the Migration

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `recurring_events_migration.sql`
5. Click **Run** to execute the migration

## Step 2: Verify the Migration

Run this query in the SQL Editor to verify the columns were added:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name LIKE 'recurrence%';
```

You should see 5 columns:
- recurrence_series_id
- recurrence_original_date
- recurrence_pattern
- recurrence_end_date
- recurrence_occurrences

## Step 3: Regenerate TypeScript Types

### Option A: Using Supabase Dashboard (Easiest)
1. Go to **Settings** → **API** in your Supabase dashboard
2. Scroll down to find the TypeScript types section
3. Copy the generated types
4. Replace the contents of `src/types/database.types.ts` with the new types

### Option B: Using Supabase CLI
```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Generate types
npm run db:generate:remote
```

### Option C: Manual Update
If the above don't work, you can manually add the recurrence fields to the Event type in `src/types/database.types.ts`:

```typescript
events: {
  Row: {
    // ... existing fields ...
    recurrence_series_id: string | null
    recurrence_original_date: string | null
    recurrence_pattern: string | null
    recurrence_end_date: string | null
    recurrence_occurrences: number | null
  }
  // ... Insert and Update types should also include these fields as optional
}
```

## Step 4: Restart Your Dev Server

After updating the types, restart your Next.js dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

## Troubleshooting

If you still get the "schema cache" error:

1. **Clear browser cache** - The Supabase client may have cached the old schema
2. **Hard refresh** - Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) in your browser
3. **Check migration status** - Verify the columns actually exist in the database
4. **Wait a few minutes** - Supabase's schema cache can take a few minutes to update

## Verification

After completing all steps, try creating a recurring event. It should work without errors!


