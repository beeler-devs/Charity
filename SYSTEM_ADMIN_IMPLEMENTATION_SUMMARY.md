# System Admin Role Implementation Summary

## Overview
Implemented a comprehensive System Admin role system that allows managing venues at a system/geographic level. The implementation includes database, API, and UI-level protections.

## Files Created/Modified

### Database Migrations
1. **`add_system_admin_role_migration.sql`**
   - Adds `is_system_admin` boolean to `profiles` table
   - Creates index for fast admin lookups
   - Safe and idempotent

2. **`restructure_venues_for_system_admin_migration.sql`**
   - Converts venues from team-level to system-level
   - Adds `region` and `is_active` fields
   - Makes `team_id` nullable (backward compatible)
   - Updates RLS policies for system admin access
   - Maintains backward compatibility for team-specific venues

### Utility Functions
1. **`src/lib/admin-utils.ts`**
   - `isSystemAdminById(userId)` - Server-side admin check
   - `isCurrentUserSystemAdmin()` - Server-side current user check
   - Use in API routes and server components

2. **`src/hooks/use-is-system-admin.ts`**
   - `useIsSystemAdmin()` - React hook for client-side admin checks
   - Returns `{ isAdmin, loading }`
   - Use in React components

### UI Components
1. **`src/app/(app)/admin/venues/page.tsx`**
   - System admin venue management page
   - Full CRUD operations for venues
   - Region filtering and search
   - Activate/deactivate venues
   - Protected route (redirects non-admins)

2. **`src/components/teams/venue-dialog.tsx`** (Updated)
   - Added support for `region` and `is_active` fields
   - Works for both system-level and team-level venues
   - Conditionally shows region/active fields for system admins

## Security Layers

### 1. Database Level (RLS Policies)
- **View**: All authenticated users can view active venues
- **System Admin View**: System admins can view all venues (including inactive)
- **System Admin CRUD**: Only system admins can create/update/delete system-level venues
- **Team Captain CRUD**: Captains can still manage team-specific venues (backward compatible)

### 2. API Level
- Use `isCurrentUserSystemAdmin()` in API routes
- Example:
  ```typescript
  const isAdmin = await isCurrentUserSystemAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  ```

### 3. UI Level
- Use `useIsSystemAdmin()` hook in components
- Conditionally render admin features
- Protected routes redirect non-admins
- Example:
  ```typescript
  const { isAdmin, loading } = useIsSystemAdmin()
  if (!isAdmin) return <AccessDenied />
  ```

## Migration Steps

### Step 1: Add System Admin Role
Run in Supabase SQL Editor:
```sql
-- Run: add_system_admin_role_migration.sql
```

### Step 2: Grant Admin Access
Grant system admin to a user:
```sql
UPDATE profiles 
SET is_system_admin = true 
WHERE id = 'USER_UUID_HERE';
```

### Step 3: Restructure Venues
Run in Supabase SQL Editor:
```sql
-- Run: restructure_venues_for_system_admin_migration.sql
```

### Step 4: Update TypeScript Types
After migrations, regenerate types:
```bash
npm run db:generate:remote
```

Or manually update `src/types/database.types.ts`:
- Add `is_system_admin?: boolean` to `profiles` table
- Add `region?: string | null` to `venues` table
- Add `is_active?: boolean` to `venues` table
- Make `team_id` optional in `venues` table

## Accessing Admin Features

### For System Admins:
1. Navigate to: `/admin/venues`
2. Manage all system-level venues
3. Filter by region
4. Search venues
5. Activate/deactivate venues

### For Team Captains:
- Still have access to team-specific venues in Team Settings
- Can create team-specific venues (backward compatible)

## Design Decisions

### Why Boolean Flag (Option 1)?
- **Simplicity**: Easiest to implement and maintain
- **Performance**: Fast lookups with indexed boolean
- **Scalability**: Can migrate to role-based system later if needed
- **Security**: Sufficient for current requirements

### Why Keep Team-Specific Venues?
- **Backward Compatibility**: Existing team venues continue to work
- **Flexibility**: Teams can have custom venues if needed
- **Migration Path**: Gradual migration from team to system venues

### Why Region Field?
- **Organization**: Group venues by geographic area
- **User Experience**: Easier to find relevant venues
- **Scalability**: Supports future regional admin roles

## Future Enhancements

1. **Regional Admins**: Extend to support regional admin roles
2. **Audit Logging**: Track admin actions for security
3. **Bulk Operations**: Import/export venues
4. **Venue Analytics**: Usage statistics per venue
5. **Integration**: Link venues to events/matches automatically

## Testing Checklist

- [ ] System admin can access `/admin/venues`
- [ ] Non-admin users are redirected from admin pages
- [ ] System admin can create/edit/delete venues
- [ ] System admin can set region and active status
- [ ] All users can view active venues
- [ ] Team captains can still manage team venues
- [ ] RLS policies prevent unauthorized access
- [ ] API routes check admin status
- [ ] UI conditionally renders based on admin status


