import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireMarketing } from '../middleware/auth.js';

const router = Router();

// List all reps with stats
router.get('/', requireMarketing, async (_req, res) => {
  const reps = await prisma.salesRep.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      profilePicUrl: true,
      isActive: true,
      onboardedVia: true,
      createdAt: true,
      _count: { select: { assignments: true } },
      assignments: { select: { status: true } },
    },
    orderBy: { name: 'asc' },
  });

  const repsWithStats = reps.map((rep) => {
    const posted = rep.assignments.filter((a) => a.status === 'posted').length;
    const pending = rep.assignments.filter((a) => a.status === 'pending').length;
    const skipped = rep.assignments.filter((a) => a.status === 'skipped').length;
    const { assignments, ...rest } = rep;
    return { ...rest, stats: { posted, pending, skipped, total: assignments.length } };
  });

  res.json(repsWithStats);
});

// Get single rep detail
router.get('/:id', requireMarketing, async (req, res) => {
  const rep = await prisma.salesRep.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      email: true,
      profilePicUrl: true,
      isActive: true,
      onboardedVia: true,
      tokenExpiry: true,
      createdAt: true,
      assignments: {
        include: {
          post: { select: { id: true, caption: true, imageUrl: true, campaignTag: true } },
        },
        orderBy: { assignedAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!rep) return res.status(404).json({ error: 'Rep not found' });
  res.json(rep);
});

// Toggle rep active status
router.put('/:id', requireMarketing, async (req, res) => {
  const { isActive } = req.body;
  const rep = await prisma.salesRep.update({
    where: { id: req.params.id },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  });
  res.json(rep);
});

// Delete a sales rep (cascade deletes assignments)
router.delete('/:id', requireMarketing, async (req, res) => {
  try {
    await prisma.salesRep.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Rep not found' });
  }
});

export default router;
