import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { notifyPendingReminder } from '../services/zohoCliq.js';

export function startScheduler() {
  // Run every minute: activate draft posts whose scheduledFor has passed
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const result = await prisma.post.updateMany({
        where: {
          status: 'draft',
          scheduledFor: { lte: now },
        },
        data: { status: 'active' },
      });

      if (result.count > 0) {
        console.log(`[scheduler] Activated ${result.count} scheduled post(s)`);
      }
    } catch (err) {
      console.error('[scheduler] Error activating posts:', err);
    }
  });

  console.log('[scheduler] Post scheduling cron started (every minute)');

  // Run every 5 minutes: auto-skip pending assignments for posts past their deadline
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      const overduePosts = await prisma.post.findMany({
        where: {
          deadline: { lte: now },
          status: 'active',
          assignments: { some: { status: 'pending' } },
        },
        select: { id: true, deadline: true },
      });

      if (overduePosts.length === 0) return;

      for (const post of overduePosts) {
        const result = await prisma.postAssignment.updateMany({
          where: { postId: post.id, status: 'pending' },
          data: {
            status: 'skipped',
            skipReason: 'Deadline passed',
            skipNotes: `Auto-skipped: deadline was ${post.deadline?.toISOString()}`,
          },
        });

        if (result.count > 0) {
          console.log(`[scheduler] Auto-skipped ${result.count} assignment(s) for post ${post.id} (deadline passed)`);
        }
      }
    } catch (err) {
      console.error('[scheduler] Error in deadline auto-skip:', err);
    }
  });

  console.log('[scheduler] Deadline auto-skip cron started (every 5 minutes)');

  // Run daily at 9:00 AM IST (3:30 UTC): send reminders to reps with pending assignments
  cron.schedule('30 3 * * *', async () => {
    try {
      console.log('[scheduler] Running daily reminder job...');

      const pendingAssignments = await prisma.postAssignment.findMany({
        where: {
          status: 'pending',
          post: {
            status: 'active',
            OR: [
              { deadline: null },
              { deadline: { gt: new Date() } },
            ],
          },
          rep: { isActive: true },
        },
        include: {
          rep: { select: { id: true, name: true, email: true, workEmail: true } },
          post: { select: { id: true, caption: true, campaignTag: true } },
        },
      });

      if (pendingAssignments.length === 0) {
        console.log('[scheduler] No pending assignments to remind about');
        return;
      }

      // Group by rep
      const byRep = new Map<string, typeof pendingAssignments>();
      for (const a of pendingAssignments) {
        const list = byRep.get(a.rep.id) || [];
        list.push(a);
        byRep.set(a.rep.id, list);
      }

      let sent = 0;
      for (const [, assignments] of byRep) {
        const rep = assignments[0].rep;
        await notifyPendingReminder({
          rep: { name: rep.name, email: rep.email, workEmail: rep.workEmail },
          pendingCount: assignments.length,
          postSummaries: assignments.map((a) => ({
            captionSnippet: a.post.caption.substring(0, 80) + (a.post.caption.length > 80 ? '...' : ''),
            campaignTag: a.post.campaignTag,
          })),
        });
        sent++;
      }

      console.log(`[scheduler] Sent reminders to ${sent} rep(s) for ${pendingAssignments.length} assignment(s)`);
    } catch (err) {
      console.error('[scheduler] Error in daily reminder:', err);
    }
  });

  console.log('[scheduler] Daily reminder cron started (9:00 AM IST)');
}
