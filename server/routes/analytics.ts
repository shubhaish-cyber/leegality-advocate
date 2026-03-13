import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireMarketing } from '../middleware/auth.js';

const router = Router();

// Overview stats
router.get('/overview', requireMarketing, async (_req, res) => {
  const [totalPosts, activePosts, totalReps, activeReps, assignments] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { status: 'active' } }),
    prisma.salesRep.count(),
    prisma.salesRep.count({ where: { isActive: true } }),
    prisma.postAssignment.groupBy({
      by: ['status'],
      _count: true,
    }),
  ]);

  const statusCounts = Object.fromEntries(
    assignments.map((a) => [a.status, a._count])
  );

  res.json({
    totalPosts,
    activePosts,
    totalReps,
    activeReps,
    totalAssignments: Object.values(statusCounts).reduce((a: number, b: any) => a + b, 0),
    posted: statusCounts['posted'] || 0,
    pending: statusCounts['pending'] || 0,
    skipped: statusCounts['skipped'] || 0,
    completionRate: (() => {
      const p = statusCounts['posted'] || 0;
      const total = p + (statusCounts['pending'] || 0) + (statusCounts['skipped'] || 0);
      return total > 0 ? Math.round((p / total) * 100) : 0;
    })(),
  });
});

// Per-rep stats
router.get('/reps', requireMarketing, async (_req, res) => {
  const reps = await prisma.salesRep.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      profilePicUrl: true,
      isActive: true,
      assignments: {
        select: {
          status: true,
          postedAt: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const repStats = reps.map((rep) => {
    const posted = rep.assignments.filter((a) => a.status === 'posted');
    return {
      id: rep.id,
      name: rep.name,
      email: rep.email,
      profilePicUrl: rep.profilePicUrl,
      isActive: rep.isActive,
      assigned: rep.assignments.length,
      posted: posted.length,
      pending: rep.assignments.filter((a) => a.status === 'pending').length,
      skipped: rep.assignments.filter((a) => a.status === 'skipped').length,
      lastPosted: rep.assignments
        .filter((a) => a.postedAt)
        .sort((a, b) => (b.postedAt!.getTime() - a.postedAt!.getTime()))[0]?.postedAt || null,
    };
  });

  res.json(repStats);
});

// Leaderboard (top 5 this month)
router.get('/leaderboard', requireMarketing, async (_req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const reps = await prisma.salesRep.findMany({
    select: {
      id: true,
      name: true,
      profilePicUrl: true,
      assignments: {
        where: { status: 'posted', postedAt: { gte: startOfMonth } },
        select: { id: true },
      },
    },
  });

  const leaderboard = reps
    .map((rep) => ({
      id: rep.id,
      name: rep.name,
      profilePicUrl: rep.profilePicUrl,
      postsThisMonth: rep.assignments.length,
    }))
    .filter((r) => r.postsThisMonth > 0)
    .sort((a, b) => b.postsThisMonth - a.postsThisMonth)
    .slice(0, 5);

  res.json(leaderboard);
});

export default router;
