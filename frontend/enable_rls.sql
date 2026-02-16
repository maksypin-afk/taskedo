-- Enable RLS for all tables
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR ORGANIZATIONS

-- 1. Everyone (authenticated) can view organizations (needed for joining by code)
CREATE POLICY "Authenticated users can view organizations" 
ON "organizations" FOR SELECT 
TO authenticated 
USING (true);

-- 2. Authenticated users can create organizations
CREATE POLICY "Authenticated users can create organizations" 
ON "organizations" FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 3. Only the owner can update the organization
CREATE POLICY "Owners can update their organization" 
ON "organizations" FOR UPDATE 
TO authenticated 
USING (auth.uid() = owner_id);

-- POLICIES FOR NOTIFICATIONS

-- 1. Users can view their own notifications
CREATE POLICY "Users can view their own notifications" 
ON "notifications" FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 2. Users can insert notifications (e.g. when assigning a task to someone else)
CREATE POLICY "Users can create notifications" 
ON "notifications" FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 3. Users can update their own notifications (e.g. mark as read)
CREATE POLICY "Users can update their own notifications" 
ON "notifications" FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- 4. Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" 
ON "notifications" FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- POLICIES FOR INVITATIONS
-- (Defaulting to restrictive as no explicit usage pattern was found in frontend)
-- We enable RLS, which by default denies all access unless a policy exists.
-- If the table is used for email invites in the future, policies can be added then.
