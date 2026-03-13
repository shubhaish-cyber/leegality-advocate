import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireMarketing } from '../middleware/auth.js';

const router = Router();

// List all marketing users
router.get('/marketing-users', requireMarketing, async (_req, res) => {
  const users = await prisma.marketingUser.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

// List all allowed emails
router.get('/allowed-emails', requireMarketing, async (_req, res) => {
  const emails = await prisma.allowedEmail.findMany({
    include: { addedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(emails);
});

// Add allowed email
router.post('/allowed-emails', requireMarketing, async (req, res) => {
  const { email, role } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });
  if (!['marketing', 'rep'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "marketing" or "rep"' });
  }

  const normalized = email.trim().toLowerCase();

  // Check for duplicate
  const existing = await prisma.allowedEmail.findUnique({ where: { email: normalized } });
  if (existing) return res.status(409).json({ error: 'Email is already in the allowed list' });

  const entry = await prisma.allowedEmail.create({
    data: {
      email: normalized,
      role,
      addedById: req.session.userId!,
    },
    include: { addedBy: { select: { name: true } } },
  });

  res.status(201).json(entry);
});

// Remove allowed email
router.delete('/allowed-emails/:id', requireMarketing, async (req, res) => {
  try {
    await prisma.allowedEmail.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Entry not found' });
  }
});

// Delete a marketing user (with superuser protection)
const PROTECTED_EMAIL = 'marketers@leegality.com';

router.delete('/marketing-users/:id', requireMarketing, async (req, res) => {
  const targetId = req.params.id;

  // Prevent self-deletion
  if (targetId === req.session.userId) {
    return res.status(403).json({ error: 'You cannot delete your own account' });
  }

  try {
    const user = await prisma.marketingUser.findUnique({ where: { id: targetId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Protect superuser
    if (user.email.toLowerCase() === PROTECTED_EMAIL) {
      return res.status(403).json({ error: 'This account is protected and cannot be deleted' });
    }

    // Remove from AllowedEmail table too
    await prisma.allowedEmail.deleteMany({ where: { email: user.email.toLowerCase() } });

    // Delete the marketing user
    await prisma.marketingUser.delete({ where: { id: targetId } });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ─── Notification settings (Zoho Cliq OAuth2 REST API) ─────

const NOTIF_KEYS = [
  'zoho_cliq_enabled',
  'zoho_cliq_client_id',
  'zoho_cliq_client_secret',
  'zoho_cliq_refresh_token',
  'zoho_cliq_channel_name',
  'zoho_cliq_domain',
];

function maskSecret(val: string): string {
  if (!val) return '';
  if (val.length <= 4) return '••••';
  return '••••••••' + val.slice(-4);
}

// Get notification config
router.get('/notifications', requireMarketing, async (_req, res) => {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: NOTIF_KEYS } },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  res.json({
    zohoCliqEnabled: map['zoho_cliq_enabled'] === 'true',
    zohoCliqClientId: map['zoho_cliq_client_id'] || '',
    zohoCliqClientSecret: maskSecret(map['zoho_cliq_client_secret'] || ''),
    zohoCliqRefreshToken: maskSecret(map['zoho_cliq_refresh_token'] || ''),
    zohoCliqChannelName: map['zoho_cliq_channel_name'] || '',
    zohoCliqDomain: map['zoho_cliq_domain'] || 'com',
  });
});

// Save notification config
router.put('/notifications', requireMarketing, async (req, res) => {
  const {
    zohoCliqEnabled,
    zohoCliqClientId,
    zohoCliqClientSecret,
    zohoCliqRefreshToken,
    zohoCliqChannelName,
    zohoCliqDomain,
  } = req.body;

  const validDomains = ['com', 'in', 'eu', 'com.au', 'com.cn'];
  const domain = validDomains.includes(zohoCliqDomain) ? zohoCliqDomain : 'com';

  const upserts = [
    prisma.appSetting.upsert({
      where: { key: 'zoho_cliq_enabled' },
      update: { value: zohoCliqEnabled ? 'true' : 'false' },
      create: { key: 'zoho_cliq_enabled', value: zohoCliqEnabled ? 'true' : 'false' },
    }),
    prisma.appSetting.upsert({
      where: { key: 'zoho_cliq_client_id' },
      update: { value: (zohoCliqClientId || '').trim() },
      create: { key: 'zoho_cliq_client_id', value: (zohoCliqClientId || '').trim() },
    }),
    prisma.appSetting.upsert({
      where: { key: 'zoho_cliq_channel_name' },
      update: { value: (zohoCliqChannelName || '').trim() },
      create: { key: 'zoho_cliq_channel_name', value: (zohoCliqChannelName || '').trim() },
    }),
    prisma.appSetting.upsert({
      where: { key: 'zoho_cliq_domain' },
      update: { value: domain },
      create: { key: 'zoho_cliq_domain', value: domain },
    }),
  ];

  // Only update secrets if non-empty and not a masked value
  if (zohoCliqClientSecret && !zohoCliqClientSecret.startsWith('••')) {
    upserts.push(
      prisma.appSetting.upsert({
        where: { key: 'zoho_cliq_client_secret' },
        update: { value: zohoCliqClientSecret.trim() },
        create: { key: 'zoho_cliq_client_secret', value: zohoCliqClientSecret.trim() },
      }),
    );
  }

  if (zohoCliqRefreshToken && !zohoCliqRefreshToken.startsWith('••')) {
    upserts.push(
      prisma.appSetting.upsert({
        where: { key: 'zoho_cliq_refresh_token' },
        update: { value: zohoCliqRefreshToken.trim() },
        create: { key: 'zoho_cliq_refresh_token', value: zohoCliqRefreshToken.trim() },
      }),
    );
  }

  await prisma.$transaction(upserts);

  // Invalidate cached access token when settings change
  const { invalidateTokenCache } = await import('../services/zohoCliq.js');
  invalidateTokenCache();

  res.json({ success: true });
});

// Send test notification
router.post('/notifications/test', requireMarketing, async (_req, res) => {
  const { notifyPostAssignment } = await import('../services/zohoCliq.js');

  const result = await notifyPostAssignment({
    postCaption: 'This is a test notification from Leegality Advocate.',
    postId: 'test',
    campaignTag: 'Test Campaign',
    assignedReps: [{ name: 'Test User', email: 'test@example.com' }],
  });

  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: result.error || 'Failed to send test notification' });
  }
});

export default router;
