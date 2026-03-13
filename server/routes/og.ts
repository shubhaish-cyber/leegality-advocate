import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

const router = Router();

router.get('/post/:postId', async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.postId },
  });

  if (!post || post.status === 'draft') {
    return res.status(404).send('Post not found');
  }

  const mediaUrl = `${config.baseUrl}/uploads/${post.imageUrl}`;
  const ogUrl = `${config.baseUrl}/og/post/${post.id}`;
  const title = post.campaignTag || post.caption.substring(0, 70) + (post.caption.length > 70 ? '...' : '');
  const description = post.caption.substring(0, 200);
  const mediaType = post.mediaType || 'image';

  res.render('og', { title, description, mediaUrl, ogUrl, mediaType });
});

export default router;
