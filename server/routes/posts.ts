import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireMarketing } from '../middleware/auth.js';
import { upload, getMediaType, validateFileSize } from '../middleware/upload.js';
import fs from 'fs';
import { notifyPostAssignment } from '../services/zohoCliq.js';
import path from 'path';
import { randomUUID } from 'crypto';

const router = Router();

// List all posts with filters
router.get('/', requireMarketing, async (req, res) => {
  const { status, campaign, search, page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const where: any = {};
  if (status && status !== 'all') where.status = status;
  if (campaign) where.campaignTag = campaign;
  if (search) where.caption = { contains: search as string };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { assignments: true } },
        assignments: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string),
    }),
    prisma.post.count({ where }),
  ]);

  const postsWithStats = posts.map((post) => {
    const posted = post.assignments.filter((a) => a.status === 'posted').length;
    const pending = post.assignments.filter((a) => a.status === 'pending').length;
    const skipped = post.assignments.filter((a) => a.status === 'skipped').length;
    const { assignments, ...rest } = post;
    return { ...rest, stats: { posted, pending, skipped, total: assignments.length } };
  });

  res.json({ posts: postsWithStats, total, page: parseInt(page as string) });
});

// Get distinct campaign tags
router.get('/campaigns', requireMarketing, async (_req, res) => {
  const posts = await prisma.post.findMany({
    where: { campaignTag: { not: null } },
    select: { campaignTag: true },
    distinct: ['campaignTag'],
  });
  res.json(posts.map((p) => p.campaignTag).filter(Boolean));
});

// Bulk actions
router.post('/bulk', requireMarketing, async (req, res) => {
  const { postIds, action } = req.body;
  if (!postIds?.length || !action) {
    return res.status(400).json({ error: 'postIds and action are required' });
  }

  if (action === 'activate') {
    const result = await prisma.post.updateMany({
      where: { id: { in: postIds } },
      data: { status: 'active' },
    });
    return res.json({ success: true, count: result.count });
  }

  if (action === 'archive') {
    const result = await prisma.post.updateMany({
      where: { id: { in: postIds } },
      data: { status: 'archived' },
    });
    return res.json({ success: true, count: result.count });
  }

  if (action === 'assign_all') {
    const reps = await prisma.salesRep.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const repIds = reps.map((r) => r.id);

    let totalNew = 0;
    for (const postId of postIds) {
      const existing = await prisma.postAssignment.findMany({
        where: { postId, repId: { in: repIds } },
        select: { repId: true },
      });
      const existingSet = new Set(existing.map((a) => a.repId));
      const newIds = repIds.filter((id) => !existingSet.has(id));
      if (newIds.length > 0) {
        await prisma.postAssignment.createMany({
          data: newIds.map((repId) => ({ postId, repId })),
        });
        totalNew += newIds.length;
      }
    }
    return res.json({ success: true, newAssignments: totalNew });
  }

  res.status(400).json({ error: 'Invalid action' });
});

// Get single post with assignments
router.get('/:id', requireMarketing, async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: {
      createdBy: { select: { name: true, email: true } },
      assignments: {
        include: { rep: { select: { id: true, name: true, email: true, profilePicUrl: true } } },
        orderBy: { assignedAt: 'desc' },
      },
    },
  });

  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// Create post
router.post('/', requireMarketing, upload.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Media file is required' });

  // Validate per-type size limit
  const sizeError = validateFileSize(req.file);
  if (sizeError) return res.status(400).json({ error: sizeError });

  const mediaType = getMediaType(req.file.mimetype);

  const { caption, campaignTag, status, scheduledFor, deadline, mediaTitle } = req.body;
  if (!caption?.trim()) return res.status(400).json({ error: 'Caption is required' });

  const post = await prisma.post.create({
    data: {
      caption: caption.trim(),
      imageUrl: req.file.filename,
      imageName: req.file.originalname,
      mediaType,
      mediaTitle: (mediaType !== 'image' && mediaTitle?.trim()) ? mediaTitle.trim().slice(0, 400) : null,
      campaignTag: campaignTag?.trim() || null,
      status: status || 'draft',
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      deadline: deadline ? new Date(deadline) : null,
      createdById: req.session.userId!,
    },
  });

  res.status(201).json(post);
});

// Update post
router.put('/:id', requireMarketing, async (req, res) => {
  const { caption, campaignTag, status, scheduledFor, deadline, mediaTitle } = req.body;
  const data: any = {};

  if (caption !== undefined) data.caption = caption.trim();
  if (campaignTag !== undefined) data.campaignTag = campaignTag?.trim() || null;
  if (status !== undefined) data.status = status;
  if (scheduledFor !== undefined) data.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
  if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
  if (mediaTitle !== undefined) data.mediaTitle = mediaTitle?.trim()?.slice(0, 400) || null;

  const post = await prisma.post.update({
    where: { id: req.params.id },
    data,
  });

  res.json(post);
});

// Replace media
router.post('/:id/media', requireMarketing, upload.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Media file is required' });

  const sizeError = validateFileSize(req.file);
  if (sizeError) return res.status(400).json({ error: sizeError });

  const mediaType = getMediaType(req.file.mimetype);

  const post = await prisma.post.update({
    where: { id: req.params.id },
    data: {
      imageUrl: req.file.filename,
      imageName: req.file.originalname,
      mediaType,
    },
  });

  res.json(post);
});

// Archive post (soft delete)
router.delete('/:id', requireMarketing, async (req, res) => {
  await prisma.post.update({
    where: { id: req.params.id },
    data: { status: 'archived' },
  });
  res.json({ success: true });
});

// Assign post to reps
router.post('/:id/assign', requireMarketing, async (req, res) => {
  const { repIds } = req.body; // array of rep IDs or "all"

  let targetRepIds: string[];
  if (repIds === 'all') {
    const reps = await prisma.salesRep.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    targetRepIds = reps.map((r) => r.id);
  } else {
    targetRepIds = repIds;
  }

  // Create assignments (skip duplicates)
  const existing = await prisma.postAssignment.findMany({
    where: { postId: req.params.id, repId: { in: targetRepIds } },
    select: { repId: true },
  });
  const existingRepIds = new Set(existing.map((a) => a.repId));
  const newRepIds = targetRepIds.filter((id) => !existingRepIds.has(id));

  if (newRepIds.length > 0) {
    await prisma.postAssignment.createMany({
      data: newRepIds.map((repId) => ({
        postId: req.params.id,
        repId,
      })),
    });
  }

  const assignments = await prisma.postAssignment.findMany({
    where: { postId: req.params.id },
    include: { rep: { select: { id: true, name: true, email: true, workEmail: true } } },
  });

  // Fire-and-forget: send Zoho Cliq notification for newly assigned reps
  if (newRepIds.length > 0) {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { caption: true, campaignTag: true },
    });
    if (post) {
      const newlyAssignedReps = assignments
        .filter((a: any) => newRepIds.includes(a.rep.id))
        .map((a: any) => ({ name: a.rep.name, email: a.rep.email, workEmail: a.rep.workEmail }));

      void notifyPostAssignment({
        postCaption: post.caption,
        postId: req.params.id,
        campaignTag: post.campaignTag,
        assignedReps: newlyAssignedReps,
      });
    }
  }

  res.json({ assignments, newCount: newRepIds.length });
});

// Get assignments for a post
router.get('/:id/assignments', requireMarketing, async (req, res) => {
  const assignments = await prisma.postAssignment.findMany({
    where: { postId: req.params.id },
    include: { rep: { select: { id: true, name: true, email: true, profilePicUrl: true } } },
    orderBy: { assignedAt: 'desc' },
  });
  res.json(assignments);
});

// Duplicate a post
router.post('/:id/duplicate', requireMarketing, async (req, res) => {
  const original = await prisma.post.findUnique({
    where: { id: req.params.id },
  });

  if (!original) return res.status(404).json({ error: 'Post not found' });

  // Copy the media file
  const ext = path.extname(original.imageUrl);
  const newFilename = `${randomUUID()}${ext}`;
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const srcPath = path.join(uploadsDir, original.imageUrl);
  const destPath = path.join(uploadsDir, newFilename);

  try {
    fs.copyFileSync(srcPath, destPath);
  } catch (err) {
    console.error('Failed to copy media file:', err);
    return res.status(500).json({ error: 'Failed to copy media file' });
  }

  const duplicate = await prisma.post.create({
    data: {
      caption: original.caption,
      imageUrl: newFilename,
      imageName: original.imageName,
      mediaType: original.mediaType,
      mediaTitle: original.mediaTitle,
      campaignTag: original.campaignTag,
      status: 'draft',
      createdById: req.session.userId!,
    },
  });

  res.status(201).json(duplicate);
});

export default router;
