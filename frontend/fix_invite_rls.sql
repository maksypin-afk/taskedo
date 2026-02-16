-- Policy to allow users to decline invitations
-- This allows deleting a team_member record if:
-- 1. The user_id is NULL (it's still a pending invite)
-- 2. The email matches the current authenticated user's email
CREATE POLICY "Users can decline their own invitations"
    ON team_members
    FOR DELETE
    TO authenticated
    USING (
        user_id IS NULL 
        AND email = auth.email()
    );

-- Also ensure users can update their own invitations (for acceptInvite)
-- Though this likely exists, adding it explicitly for clarity/completeness
CREATE POLICY "Users can accept their own invitations"
    ON team_members
    FOR UPDATE
    TO authenticated
    USING (
        user_id IS NULL 
        AND email = auth.email()
    )
    WITH CHECK (
        user_id = auth.uid()
    );
