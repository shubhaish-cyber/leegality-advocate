import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireMarketing } from '../middleware/auth.js';

const router = Router();

// Generate invite link
router.post('/', requireMarketing, async (req, res) => {
  const invite = await prisma.inviteLink.create({
    data: {
      createdById: req.session.userId!,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  res.status(201).json(invite);
});

// List all invite links (with pagination)
router.get('/', requireMarketing, async (req, res) => {
  const { page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const [invites, total] = await Promise.all([
    prisma.inviteLink.findMany({
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.inviteLink.count(),
  ]);

  res.json({ invites, total, page: parseInt(page as string) });
});

// Revoke an invite link
router.delete('/:id', requireMarketing, async (req, res) => {
  await prisma.inviteLink.update({
    where: { id: req.params.id },
    data: { isRevoked: true },
  });
  res.json({ success: true });
});

// Extend invite link expiry by 7 days
router.patch('/:id/extend', requireMarketing, async (req, res) => {
  const invite = await prisma.inviteLink.findUnique({
    where: { id: req.params.id },
  });

  if (!invite) return res.status(404).json({ error: 'Invite not found' });

  const newExpiry = new Date(
    Math.max(invite.expiresAt.getTime(), Date.now()) + 7 * 24 * 60 * 60 * 1000
  );

  const updated = await prisma.inviteLink.update({
    where: { id: req.params.id },
    data: { expiresAt: newExpiry },
  });

  res.json(updated);
});

// Validate invite token (public)
router.get('/:token/validate', async (req, res) => {
  const invite = await prisma.inviteLink.findUnique({
    where: { token: req.params.token },
  });

  if (!invite) return res.json({ valid: false, reason: 'not_found' });
  if (invite.isUsed) return res.json({ valid: false, reason: 'already_used' });
  if (invite.isRevoked) return res.json({ valid: false, reason: 'revoked' });
  if (invite.expiresAt < new Date()) return res.json({ valid: false, reason: 'expired' });

  res.json({ valid: true });
});

export default router;
