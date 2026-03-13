import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireMarketing } from '../middleware/auth.js';

const router = Router();

// List all campaigns with post counts
router.get('/', requireMarketing, async (_req, res) => {
  const result = await prisma.post.groupBy({
    by: ['campaignTag'],
    where: { campaignTag: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  const campaigns = result.map((r) => ({
    name: r.campaignTag!,
    postCount: r._count.id,
  }));

  res.json(campaigns);
});

// Rename a campaign
router.put('/:name', requireMarketing, async (req, res) => {
  const { newName } = req.body;
  if (!newName?.trim()) {
    return res.status(400).json({ error: 'New name is required' });
  }

  const result = await prisma.post.updateMany({
    where: { campaignTag: req.params.name },
    data: { campaignTag: newName.trim() },
  });

  res.json({ success: true, count: result.count });
});

// Merge campaigns: source → target
router.post('/merge', requireMarketing, async (req, res) => {
  const { source, target } = req.body;
  if (!source || !target) {
    return res.status(400).json({ error: 'source and target are required' });
  }

  const result = await prisma.post.updateMany({
    where: { campaignTag: source },
    data: { campaignTag: target },
  });

  res.json({ success: true, count: result.count });
});

// Remove a campaign tag (set to null)
router.delete('/:name', requireMarketing, async (req, res) => {
  const result = await prisma.post.updateMany({
    where: { campaignTag: req.params.name },
    data: { campaignTag: null },
  });

  res.json({ success: true, count: result.count });
});

export default router;
