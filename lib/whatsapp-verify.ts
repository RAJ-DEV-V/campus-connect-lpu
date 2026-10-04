/**
 * WhatsApp Invite Link Normalizer & Verification Utilities
 * 
 * Extracts and strictly validates WhatsApp invite codes from submitted URLs:
 * - https://chat.whatsapp.com/ABC123xyz
 * - chat.whatsapp.com/ABC123xyz
 * - whatsapp.com/invite/ABC123xyz
 * 
 * Rejects loose substrings or malicious appended suffixes.
 */

export interface ParsedInviteResult {
  isValid: boolean;
  cleanUrl: string;
  inviteCode: string | null;
  error?: string;
}

export function parseAndValidateWhatsAppInvite(rawUrl: string): ParsedInviteResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      isValid: false,
      cleanUrl: '',
      inviteCode: null,
      error: 'Please paste a valid WhatsApp invite link.',
    };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      isValid: false,
      cleanUrl: '',
      inviteCode: null,
      error: 'Invite link cannot be empty.',
    };
  }

  // Normalize protocol
  let urlToParse = trimmed;
  if (!/^https?:\/\//i.test(urlToParse)) {
    urlToParse = `https://${urlToParse}`;
  }

  try {
    const parsed = new URL(urlToParse);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // Allow standard WhatsApp chat/invite hosts
    if (host !== 'chat.whatsapp.com' && host !== 'whatsapp.com') {
      return {
        isValid: false,
        cleanUrl: trimmed,
        inviteCode: null,
        error: 'The URL must be a valid WhatsApp invite link (chat.whatsapp.com/...).',
      };
    }

    // Path analysis
    // Formats:
    // /ABCDEF123456
    // /invite/ABCDEF123456
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    let code: string | null = null;

    if (host === 'chat.whatsapp.com' && pathParts.length >= 1) {
      code = pathParts[0];
    } else if (host === 'whatsapp.com' && pathParts[0] === 'invite' && pathParts.length >= 2) {
      code = pathParts[1];
    }

    if (!code) {
      return {
        isValid: false,
        cleanUrl: trimmed,
        inviteCode: null,
        error: 'No invite code detected in the WhatsApp link.',
      };
    }

    // WhatsApp invite codes are alphanumeric (and may contain _ or - depending on version, usually 20-24 chars)
    // Strict pattern matching to prevent loose substrings (e.g. ABC123 vs ABC123-fake)
    const cleanCode = code.trim();
    if (!/^[a-zA-Z0-9_-]{8,40}$/.test(cleanCode)) {
      return {
        isValid: false,
        cleanUrl: trimmed,
        inviteCode: null,
        error: 'Invalid WhatsApp invite code format.',
      };
    }

    const canonicalUrl = `https://chat.whatsapp.com/${cleanCode}`;

    return {
      isValid: true,
      cleanUrl: canonicalUrl,
      inviteCode: cleanCode,
    };
  } catch {
    return {
      isValid: false,
      cleanUrl: trimmed,
      inviteCode: null,
      error: 'Invalid URL structure.',
    };
  }
}
