-- Add RLS policy to allow users to create their own profile
-- This is needed as a fallback if the trigger doesn't fire (e.g., OAuth users)
CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

