-- =============================================
-- Geofence Attendance System - Supabase Migration
-- Run this SQL in Supabase SQL Editor
-- =============================================

-- 1. Геозоны организации
CREATE TABLE IF NOT EXISTS geofences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Офис',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Логи посещаемости
CREATE TABLE IF NOT EXISTS attendance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    geofence_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Индексы
CREATE INDEX IF NOT EXISTS idx_geofences_org ON geofences(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON attendance_logs(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance_logs(user_id);

-- 4. RLS (Row Level Security)
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- Геозоны: владелец может всё, остальные — только чтение
CREATE POLICY "Owner can manage geofences" ON geofences
    FOR ALL USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Members can view geofences" ON geofences
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- Логи посещаемости: владелец видит все, сотрудник — только свои
CREATE POLICY "Owner can view all attendance" ON attendance_logs
    FOR SELECT USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "User can view own attendance" ON attendance_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert attendance" ON attendance_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());
