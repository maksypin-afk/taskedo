/**
 * Generates initials from a name string.
 * - If 2+ words: take first characters of the first two words.
 * - If 1 word: take the first character.
 * Everything returned in uppercase.
 */
export function getInitials(name: string): string {
    if (!name) return '?';

    // Remove extra spaces and split by whitespace
    const words = name.trim().split(/\s+/).filter(word => word.length > 0);

    if (words.length === 0) return '?';

    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }

    return words[0][0].toUpperCase();
}

/**
 * Checks if an avatar URL is a "real" uploaded file.
 * Currently, only files hosted on our Supabase storage are considered uploaded.
 * This filters out auto-generated/default avatars from external services.
 */
export function isUploadedAvatar(url: string | null | undefined): boolean {
    if (!url) return false;
    const trimmed = url.trim();
    return /^https?:\/\//.test(trimmed) || trimmed.startsWith('/');
}
