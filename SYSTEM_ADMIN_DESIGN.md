# System Admin Role Design Options

## Overview
We need to create a System Admin role that allows managing venues at a system/geographic level (not per team). The role must be protected at Database, API, and UI levels.

## Design Options

### Option 1: Boolean Flag in Profiles Table (Recommended)
**Approach**: Add `is_system_admin BOOLEAN DEFAULT false` to the `profiles` table.

**Pros:**
- Simple and straightforward
- Easy to query (`WHERE is_system_admin = true`)
- Fast lookups (can be indexed)
- Minimal schema changes
- Works well with existing RLS patterns

**Cons:**
- Less flexible if we need multiple admin roles later
- Single boolean doesn't scale to role hierarchies

**Implementation:**
```sql
ALTER TABLE profiles ADD COLUMN is_system_admin BOOLEAN DEFAULT false;
CREATE INDEX idx_profiles_system_admin ON profiles(is_system_admin) WHERE is_system_admin = true;
```

### Option 2: Separate System Admins Table
**Approach**: Create a `system_admins` table with `user_id` references.

**Pros:**
- Clean separation of concerns
- Can add metadata (granted_by, granted_at, etc.)
- Easy to audit admin access
- Can add additional admin-specific fields

**Cons:**
- Requires JOINs for permission checks
- More complex RLS policies
- Additional table to maintain

**Implementation:**
```sql
CREATE TABLE system_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);
```

### Option 3: Role-Based System (Most Flexible)
**Approach**: Create a `user_roles` table supporting multiple roles.

**Pros:**
- Most flexible and scalable
- Supports future roles (moderator, regional_admin, etc.)
- Can have multiple roles per user
- Industry standard approach

**Cons:**
- More complex to implement
- Requires more queries for permission checks
- Overkill if we only need one admin role

**Implementation:**
```sql
CREATE TYPE user_role_type AS ENUM ('system_admin', 'moderator', 'regional_admin');
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role_type NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);
```

## Recommended Approach: Option 1 (Boolean Flag)

**Rationale:**
- Simplest to implement and maintain
- Meets current requirements
- Can be migrated to Option 3 later if needed
- Fast permission checks
- Easy to understand and debug

## Implementation Plan

### 1. Database Level
- Add `is_system_admin` to `profiles` table
- Create index for fast lookups
- Update venues table to be system-level (remove `team_id`, add `region` or keep global)
- Create RLS policies that:
  - Allow system admins full access to venues
  - Allow all users to view venues (for selection)
  - Only system admins can create/update/delete

### 2. API Level
- Create utility function: `isSystemAdmin(userId: string)`
- Add middleware/checks in API routes:
  ```typescript
  const isAdmin = await isSystemAdmin(user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  ```

### 3. UI Level
- Create utility hook: `useIsSystemAdmin()`
- Conditionally render admin UI based on role
- Create `/admin` route with admin dashboard
- Protect admin routes with middleware

### 4. Venues Restructure
- Remove `team_id` from venues (or make nullable)
- Add optional `region` field for geographic organization
- System admins can manage all venues
- Users can view/select venues when creating events

## Security Considerations

1. **Database (RLS)**: Primary security layer - even if API/UI is bypassed
2. **API Routes**: Server-side validation - protects against client manipulation
3. **UI**: User experience - hides features but doesn't secure them
4. **Audit Trail**: Consider logging admin actions for security auditing

## Migration Strategy

1. Add `is_system_admin` column to profiles
2. Manually set initial admin(s) via SQL
3. Update venues table structure
4. Update RLS policies
5. Create admin UI
6. Test thoroughly before production






