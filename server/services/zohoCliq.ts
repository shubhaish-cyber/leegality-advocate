import { prisma } from '../lib/prisma.js';

interface CliqNotificationPayload {
  postCaption: string;
  postId: string;
  campaignTag: string | null;
  assignedReps: Array<{ name: string; email: string; workEmail?: string | null }>;
}

interface CliqResult {
  success: boolean;
  error?: string;
}

interface CliqConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  channelName: string;
  domain: string; // com, in, eu, com.au
}

// In-memory access token cache
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

const SETTING_KEYS = [
  'zoho_cliq_enabled',
  'zoho_cliq_client_id',
  'zoho_cliq_client_secret',
  'zoho_cliq_refresh_token',
  'zoho_cliq_channel_name',
  'zoho_cliq_domain',
];

async function getConfig(): Promise<CliqConfig | null> {
  try {
    const settings = await prisma.appSetting.findMany({
      where: { key: { in: SETTING_KEYS } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    if (map['zoho_cliq_enabled'] !== 'true') return null;

    const config: CliqConfig = {
      clientId: map['zoho_cliq_client_id'] || '',
      clientSecret: map['zoho_cliq_client_secret'] || '',
      refreshToken: map['zoho_cliq_refresh_token'] || '',
      channelName: map['zoho_cliq_channel_name'] || '',
      domain: map['zoho_cliq_domain'] || 'com',
    };

    if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.channelName) {
      console.warn('[zoho-cliq] Missing OAuth config, skipping notification');
      return null;
    }

    return config;
  } catch {
    return null;
  }
}

async function getAccessToken(config: CliqConfig): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const tokenUrl = `https://accounts.zoho.${config.domain}/oauth/v2/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json() as any;

  if (!data.access_token) {
    throw new Error(data.error || 'Token refresh failed');
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedAccessToken!;
}

function formatMessage(payload: CliqNotificationPayload, appUrl?: string): string {
  const repTags = payload.assignedReps
    .map((rep) => `{@${rep.workEmail || rep.email}}`)
    .join(' ');

  const link = appUrl || 'https://advocate.leegality.com';

  const lines = [
    `*New LinkedIn Post Assigned*`,
    ``,
    `*Assigned to:* ${repTags}`,
    ``,
    `Post it in 2 clicks - ${link}`,
  ];

  return lines.join('\n');
}

interface CliqReminderPayload {
  rep: { name: string; email: string; workEmail?: string | null };
  pendingCount: number;
  postSummaries: Array<{ captionSnippet: string; campaignTag: string | null }>;
}

function formatReminderMessage(payload: CliqReminderPayload, appUrl?: string): string {
  const tag = `{@${payload.rep.workEmail || payload.rep.email}}`;
  const link = appUrl || 'https://advocate.leegality.com';
  const s = payload.pendingCount > 1 ? 's' : '';

  const lines = [
    `*Reminder: ${payload.pendingCount} pending post${s}*`,
    ``,
    `${tag} you have ${payload.pendingCount} post${s} waiting to be shared.`,
    ``,
  ];

  const show = payload.postSummaries.slice(0, 3);
  show.forEach((p, i) => {
    const tagStr = p.campaignTag ? ` [${p.campaignTag}]` : '';
    lines.push(`${i + 1}. ${p.captionSnippet}${tagStr}`);
  });

  if (payload.postSummaries.length > 3) {
    lines.push(`...and ${payload.postSummaries.length - 3} more`);
  }

  lines.push(``, `Post them in 2 clicks - ${link}`);

  return lines.join('\n');
}

export function invalidateTokenCache() {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

export async function notifyPostAssignment(
  payload: CliqNotificationPayload,
): Promise<CliqResult> {
  try {
    const config = await getConfig();
    if (!config) return { success: true };

    const accessToken = await getAccessToken(config);
    const message = formatMessage(payload);

    const apiUrl = `https://cliq.zoho.${config.domain}/api/v1/channelsbyname/${encodeURIComponent(config.channelName)}/message`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      },
      body: JSON.stringify({ text: message }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      console.error(`[zoho-cliq] API call failed: ${response.status} ${errText}`);

      // If 401, invalidate cache so next call refreshes
      if (response.status === 401) {
        invalidateTokenCache();
      }

      return { success: false, error: `HTTP ${response.status}` };
    }

    console.log(`[zoho-cliq] Notification sent for post ${payload.postId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[zoho-cliq] Notification error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function notifyPendingReminder(
  payload: CliqReminderPayload,
): Promise<CliqResult> {
  try {
    const config = await getConfig();
    if (!config) return { success: true };

    const accessToken = await getAccessToken(config);
    const message = formatReminderMessage(payload);

    const apiUrl = `https://cliq.zoho.${config.domain}/api/v1/channelsbyname/${encodeURIComponent(config.channelName)}/message`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      },
      body: JSON.stringify({ text: message }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      console.error(`[zoho-cliq] Reminder API call failed: ${response.status} ${errText}`);
      if (response.status === 401) invalidateTokenCache();
      return { success: false, error: `HTTP ${response.status}` };
    }

    console.log(`[zoho-cliq] Reminder sent to ${payload.rep.name} (${payload.pendingCount} pending)`);
    return { success: true };
  } catch (err: any) {
    console.error('[zoho-cliq] Reminder error:', err.message);
    return { success: false, error: err.message };
  }
}
