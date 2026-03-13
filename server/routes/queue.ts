import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireRep } from '../middleware/auth.js';
import { config } from '../config.js';
import { publishToLinkedIn } from '../services/linkedin.js';

const router = Router();

// Get rep's queue
router.get('/', requireRep, async (req, res) => {
  const { status: filterStatus } = req.query;
  const repId = req.session.userId!;

  const where: any = {
    repId,
    post: {
      status: 'active',
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
  };

  if (filterStatus && filterStatus !== 'all') {
    where.status = filterStatus;
  }

  const assignments = await prisma.postAssignment.findMany({
    where,
    include: {
      post: {
        select: {
          id: true,
          caption: true,
          imageUrl: true,
          mediaType: true,
          campaignTag: true,
          createdAt: true,
          deadline: true,
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });

  res.json(assignments);
});

// Get single assignment detail
router.get('/:id', requireRep, async (req, res) => {
  const assignment = await prisma.postAssignment.findFirst({
    where: { id: req.params.id, repId: req.session.userId! },
    include: {
      post: true,
    },
  });

  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  // Build the share URL
  const ogUrl = `${config.baseUrl}/og/post/${assignment.post.id}`;
  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(ogUrl)}`;

  res.json({ ...assignment, shareUrl, ogUrl });
});

// Mark as posted
router.post('/:id/posted', requireRep, async (req, res) => {
  const assignment = await prisma.postAssignment.updateMany({
    where: { id: req.params.id, repId: req.session.userId! },
    data: { status: 'posted', postedAt: new Date() },
  });

  if (assignment.count === 0) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ success: true });
});

// Publish directly to LinkedIn via API
router.post('/:id/publish', requireRep, async (req, res) => {
  try {
    const assignment = await prisma.postAssignment.findFirst({
      where: { id: req.params.id, repId: req.session.userId! },
      include: { post: true },
    });

    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (assignment.status === 'posted') return res.status(400).json({ error: 'Already posted' });

    const rep = await prisma.salesRep.findUnique({
      where: { id: req.session.userId! },
    });

    if (!rep) return res.status(404).json({ error: 'Rep not found' });
    if (!rep.accessToken) return res.status(400).json({ error: 'LinkedIn not connected' });
    if (rep.tokenExpiry && rep.tokenExpiry < new Date()) {
      return res.status(401).json({ error: 'LinkedIn token expired. Please re-authenticate.' });
    }

    const result = await publishToLinkedIn(
      rep.accessToken,
      rep.linkedInId,
      assignment.post.caption,
      assignment.post.imageUrl,
      (assignment.post.mediaType as 'image' | 'video' | 'document') || 'image',
      assignment.post.mediaTitle
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to publish to LinkedIn' });
    }

    // Mark as posted and store LinkedIn post ID
    await prisma.postAssignment.update({
      where: { id: assignment.id },
      data: {
        status: 'posted',
        postedAt: new Date(),
        linkedInPostId: result.linkedInPostId || null,
      },
    });

    res.json({ success: true, linkedInPostId: result.linkedInPostId });
  } catch (err: any) {
    console.error('Publish error:', err);
    res.status(500).json({ error: 'Failed to publish to LinkedIn' });
  }
});

// Repost a previously posted assignment to LinkedIn
router.post('/:id/repost', requireRep, async (req, res) => {
  try {
    const assignment = await prisma.postAssignment.findFirst({
      where: { id: req.params.id, repId: req.session.userId! },
      include: { post: true },
    });

    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (assignment.status !== 'posted') return res.status(400).json({ error: 'Only posted items can be reposted' });

    const rep = await prisma.salesRep.findUnique({
      where: { id: req.session.userId! },
    });

    if (!rep) return res.status(404).json({ error: 'Rep not found' });
    if (!rep.accessToken) return res.status(400).json({ error: 'LinkedIn not connected' });
    if (rep.tokenExpiry && rep.tokenExpiry < new Date()) {
      return res.status(401).json({ error: 'LinkedIn token expired. Please re-authenticate.' });
    }

    const result = await publishToLinkedIn(
      rep.accessToken,
      rep.linkedInId,
      assignment.post.caption,
      assignment.post.imageUrl,
      (assignment.post.mediaType as 'image' | 'video' | 'document') || 'image',
      assignment.post.mediaTitle
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to repost to LinkedIn' });
    }

    // Update with new post ID and timestamp
    await prisma.postAssignment.update({
      where: { id: assignment.id },
      data: {
        postedAt: new Date(),
        linkedInPostId: result.linkedInPostId || null,
      },
    });

    res.json({ success: true, linkedInPostId: result.linkedInPostId });
  } catch (err: any) {
    console.error('Repost error:', err);
    res.status(500).json({ error: 'Failed to repost to LinkedIn' });
  }
});

// Mark as skipped with optional feedback
router.post('/:id/skip', requireRep, async (req, res) => {
  const { reason, notes } = req.body || {};

  const assignment = await prisma.postAssignment.updateMany({
    where: { id: req.params.id, repId: req.session.userId! },
    data: {
      status: 'skipped',
      skipReason: reason || null,
      skipNotes: notes?.trim() || null,
    },
  });

  if (assignment.count === 0) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ success: true });
});

// Save work email
router.put('/profile/work-email', requireRep, async (req, res) => {
  const { workEmail } = req.body;
  if (!workEmail?.trim()) return res.status(400).json({ error: 'Work email is required' });

  const normalized = workEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  await prisma.salesRep.update({
    where: { id: req.session.userId! },
    data: { workEmail: normalized },
  });

  res.json({ success: true, workEmail: normalized });
});

export default router;
