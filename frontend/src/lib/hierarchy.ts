import type { DbTeamMember } from './teamService';

/**
 * Recursively finds all subordinates for a given member.
 * @param team The full list of team members.
 * @param memberId The ID of the member whose subordinates to find.
 * @returns An array of all members in the reporting line under this member.
 */
export function getAllSubordinates(team: DbTeamMember[], memberId: string): DbTeamMember[] {
    const directSubs = team.filter(m => m.manager_id === memberId);
    let allSubs = [...directSubs];

    for (const sub of directSubs) {
        allSubs = [...allSubs, ...getAllSubordinates(team, sub.id)];
    }

    return allSubs;
}

/**
 * Returns the list of eligible assignees for a given user.
 * - If the user has no manager_id, they are a top-level user and can assign to anyone.
 * - Otherwise, they can only assign to themselves and their recursive subordinates.
 */
export function getEligibleAssignees(team: DbTeamMember[], currentUserId: string): DbTeamMember[] {
    const currentMember = team.find(m => m.user_id === currentUserId);
    if (!currentMember) return [];

    // Top-level users (no manager_id) can assign to anyone
    if (!currentMember.manager_id) {
        return team;
    }

    // Others can assign to themselves and their subordinates
    const subordinates = getAllSubordinates(team, currentMember.id);
    return [currentMember, ...subordinates];
}

/**
 * Returns a list of names of members whose tasks are visible to the current user.
 * - Top-level: All names in the team.
 * - Others: Their own name + all subordinates' names.
 */
export function getVisibleAssigneeNames(team: DbTeamMember[], currentUserId: string): string[] {
    const currentMember = team.find(m => m.user_id === currentUserId);
    if (!currentMember) return [];

    // Top-level users see everyone
    if (!currentMember.manager_id) {
        return team.map(m => m.name);
    }

    // Others see themselves and their subordinates
    const subordinates = getAllSubordinates(team, currentMember.id);
    return [currentMember.name, ...subordinates.map(s => s.name)];
}
/**
 * Returns a list of user IDs whose tasks are visible to the current user.
 */
export function getVisibleUserIds(team: DbTeamMember[], currentUserId: string): string[] {
    const currentMember = team.find(m => m.user_id === currentUserId);
    if (!currentMember) return [];

    // Top-level users see everyone
    if (!currentMember.manager_id) {
        return team.map(m => m.user_id);
    }

    // Others see themselves and their subordinates
    const subordinates = getAllSubordinates(team, currentMember.id);
    return [currentMember.user_id, ...subordinates.map(s => s.user_id)];
}
