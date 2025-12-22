# Fix Pasha's Roster Linking Issue

## Problem
Pasha Malevi was added to "Slice Cream Cream Sundaes" team roster, then signed up with an account, but the teams aren't showing up.

## Diagnostic Steps

### 1. Check if the SQL migration was run
Run this in Supabase SQL Editor:
```sql
SELECT proname FROM pg_proc WHERE proname = 'link_roster_members_to_user';
```

**If no results**: The migration hasn't been run. Run `link_roster_members_on_signup.sql` first.

### 2. Check the roster member record
Run `diagnose_roster_linking.sql` in Supabase SQL Editor to:
- Find Pasha's roster member record
- Check if email is set
- Check if user_id is already set
- Verify email format

### 3. Check email matching
Common issues:
- **Case sensitivity**: "Pasha@Email.com" vs "pasha@email.com" (should be handled, but verify)
- **Spaces**: " pasha@email.com " vs "pasha@email.com" (should be handled)
- **Different emails**: Email used when adding to roster vs email used for signup

### 4. Manual fix (if needed)
If the automatic linking didn't work, use `manual_link_roster_member.sql` to manually link the roster member to Pasha's user account.

## Quick Fix Steps

1. **Run diagnostic query** (`diagnose_roster_linking.sql`)
2. **Verify emails match** (check normalized emails in step 4)
3. **If emails match but not linked**:
   - Option A: Run the function manually (if it exists)
   - Option B: Manually update the roster_member record
4. **If emails don't match**: Update the roster_member email to match the profile email

## Prevention

After fixing, ensure:
- ✅ SQL migration `link_roster_members_on_signup.sql` has been run
- ✅ The function `link_roster_members_to_user` exists and is accessible
- ✅ Future signups will automatically link (test with a new user)


