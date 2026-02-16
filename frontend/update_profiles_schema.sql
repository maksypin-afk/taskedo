-- Comprehensive profiles schema fix
-- This ensures all columns exist and data remains intact IF they already exist.
DO $$ 
BEGIN
    -- Columns for basic info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
        ALTER TABLE profiles ADD COLUMN display_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
    END IF;

    -- Columns for contact info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'birthday') THEN
        ALTER TABLE profiles ADD COLUMN birthday DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE profiles ADD COLUMN phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'whatsapp') THEN
        ALTER TABLE profiles ADD COLUMN whatsapp TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'telegram') THEN
        ALTER TABLE profiles ADD COLUMN telegram TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- RLS for profiles: allow members of the same organization to see each other's profiles
-- We DROP and RE-CREATE to ensure the policy is correctly applied including organization members
DROP POLICY IF EXISTS "Members of same organization can view each other's profiles" ON profiles;

CREATE POLICY "Members of same organization can view each other's profiles"
ON profiles FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM team_members AS current_user_membership
        WHERE current_user_membership.user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM team_members AS target_user_membership
            WHERE target_user_membership.user_id = profiles.id
            AND target_user_membership.organization_id = current_user_membership.organization_id
        )
    )
    OR auth.uid() = id -- Users can always see their own profile
);
