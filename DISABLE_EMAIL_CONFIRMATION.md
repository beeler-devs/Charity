# Disable Email Confirmation in Supabase

To allow users to sign up without email confirmation, you need to disable it in your Supabase dashboard.

## Steps:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Settings** (in the left sidebar)
4. Scroll down to the **Email Auth** section
5. Find **"Enable email confirmations"** toggle
6. **Turn it OFF** (disable it)
7. Click **Save**

## What This Does:

- Users will be automatically signed in immediately after signup
- No email confirmation required
- Profile will be created automatically via database trigger
- Users can start using the app right away

## Note:

The code has been updated to handle both scenarios:
- If email confirmation is **disabled**: Users are signed in immediately and redirected to `/home`
- If email confirmation is **enabled**: Users are told to check their email and redirected to login

After disabling email confirmation, restart your development server for the changes to take effect.

