import { Router } from 'express';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../services/crypto.js';

const router = Router();

// In dev, redirect to Vite dev server (port 5173) instead of Express (port 3000)
const clientRedirect = (path: string) => `${config.clientUrl}${path}`;

// ─── Google SSO for Marketing Users ──────────────────────────

router.get('/google', (req, res) => {
  const redirectUri = `${config.baseUrl}${config.google.callbackUrl}`;
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(clientRedirect('/?error=no_code'));

  try {
    const redirectUri = `${config.baseUrl}${config.google.callbackUrl}`;
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.id_token) {
      return res.redirect(clientRedirect('/?error=token_failed'));
    }

    // Decode the ID token (JWT) to get user info
    const payload = JSON.parse(
      Buffer.from(tokens.id_token.split('.')[1], 'base64').toString()
    );

    const email = payload.email?.toLowerCase();
    if (!email) return res.redirect(clientRedirect('/?error=no_email'));

    // Check whitelist: env var first, then DB-driven AllowedEmail table
    if (config.marketingAllowedEmails.length > 0) {
      const inEnv = config.marketingAllowedEmails.includes(email);
      if (!inEnv) {
        const dbAllowed = await prisma.allowedEmail.findFirst({
          where: { email, role: 'marketing' },
        });
        if (!dbAllowed) {
          return res.redirect(clientRedirect('/?error=unauthorized'));
        }
      }
    }

    // Upsert marketing user
    const user = await prisma.marketingUser.upsert({
      where: { googleId: payload.sub },
      update: { name: payload.name || email, avatarUrl: payload.picture },
      create: {
        googleId: payload.sub,
        email,
        name: payload.name || email,
        avatarUrl: payload.picture,
        role: 'admin',
      },
    });

    req.session.userId = user.id;
    req.session.userType = 'marketing';
    res.redirect(clientRedirect('/marketing/dashboard'));
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(clientRedirect('/?error=server_error'));
  }
});

// ─── LinkedIn OAuth for Sales Reps ──────────────────────────

router.get('/linkedin', (req, res) => {
  const inviteToken = req.query.invite as string | undefined;
  const redirectUri = `${config.baseUrl}${config.linkedin.callbackUrl}`;
  const state = inviteToken
    ? `${crypto.randomUUID()}_invite_${inviteToken}`
    : crypto.randomUUID();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.linkedin.clientId,
    redirect_uri: redirectUri,
    scope: config.linkedin.scopes.join(' '),
    state,
  });

  // Store state in session for CSRF validation
  req.session.oauthState = state;

  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
  }
}

router.get('/linkedin/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect(clientRedirect('/?error=no_code'));

  try {
    const redirectUri = `${config.baseUrl}${config.linkedin.callbackUrl}`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        client_id: config.linkedin.clientId,
        client_secret: config.linkedin.clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      return res.redirect(clientRedirect('/?error=token_failed'));
    }

    // Get user info from LinkedIn
    const userInfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    // Encrypt the access token before storing
    const encryptedToken = encrypt(tokens.access_token);
    const tokenExpiry = new Date(Date.now() + (tokens.expires_in || 5184000) * 1000);

    // Upsert sales rep
    const rep = await prisma.salesRep.upsert({
      where: { linkedInId: userInfo.sub },
      update: {
        accessToken: encryptedToken,
        tokenExpiry,
        name: userInfo.name || userInfo.email,
        profilePicUrl: userInfo.picture,
      },
      create: {
        linkedInId: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name || userInfo.email,
        accessToken: encryptedToken,
        tokenExpiry,
        profilePicUrl: userInfo.picture,
      },
    });

    // Handle reconnect if present — update existing rep's tokens and redirect
    const stateStr = state as string;
    if (stateStr?.includes('_reconnect_')) {
      const reconnectRepId = stateStr.split('_reconnect_')[1];
      if (reconnectRepId) {
        await prisma.salesRep.update({
          where: { id: reconnectRepId },
          data: {
            accessToken: encryptedToken,
            tokenExpiry,
          },
        });
        req.session.userId = reconnectRepId;
        req.session.userType = 'rep';
        return res.redirect(clientRedirect('/rep/queue?reconnected=true'));
      }
    }

    // Handle invite token if present
    if (stateStr?.includes('_invite_')) {
      const inviteToken = stateStr.split('_invite_')[1];
      if (inviteToken) {
        const invite = await prisma.inviteLink.findUnique({
          where: { token: inviteToken },
        });
        if (invite && !invite.isUsed && invite.expiresAt > new Date()) {
          await prisma.inviteLink.update({
            where: { id: invite.id },
            data: { isUsed: true, usedByEmail: rep.email },
          });
          await prisma.salesRep.update({
            where: { id: rep.id },
            data: { onboardedVia: inviteToken },
          });
        }
      }
    }

    req.session.userId = rep.id;
    req.session.userType = 'rep';
    res.redirect(clientRedirect('/rep/queue'));
  } catch (err) {
    console.error('LinkedIn OAuth error:', err);
    res.redirect(clientRedirect('/?error=server_error'));
  }
});

// ─── LinkedIn Token Reconnect ────────────────────────────────

router.get('/linkedin/reconnect', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'rep') {
    return res.redirect(clientRedirect('/?error=not_authenticated'));
  }

  const repId = req.session.userId;
  const redirectUri = `${config.baseUrl}${config.linkedin.callbackUrl}`;
  const state = `${crypto.randomUUID()}_reconnect_${repId}`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.linkedin.clientId,
    redirect_uri: redirectUri,
    scope: config.linkedin.scopes.join(' '),
    state,
  });

  req.session.oauthState = state;
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

// ─── Current User ────────────────────────────────────────────

router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }

  try {
    if (req.session.userType === 'marketing') {
      const user = await prisma.marketingUser.findUnique({
        where: { id: req.session.userId },
        select: { id: true, name: true, email: true, role: true, avatarUrl: true },
      });
      return res.json({ user, userType: 'marketing' });
    }

    if (req.session.userType === 'rep') {
      const user = await prisma.salesRep.findUnique({
        where: { id: req.session.userId },
        select: { id: true, name: true, email: true, profilePicUrl: true, tokenExpiry: true, workEmail: true },
      });
      return res.json({ user, userType: 'rep' });
    }

    res.json({ user: null });
  } catch {
    res.json({ user: null });
  }
});

// ─── Dev-only login bypass ───────────────────────────────────

if (config.isDev) {
  router.get('/dev-login/marketing', async (req, res) => {
    const user = await prisma.marketingUser.upsert({
      where: { email: 'dev@leegality.com' },
      update: {},
      create: {
        googleId: 'dev-google-id',
        email: 'dev@leegality.com',
        name: 'Dev Marketing User',
        role: 'admin',
      },
    });
    req.session.userId = user.id;
    req.session.userType = 'marketing';
    res.redirect(clientRedirect('/marketing/dashboard'));
  });

  router.get('/dev-login/rep', async (req, res) => {
    const rep = await prisma.salesRep.upsert({
      where: { linkedInId: 'dev-linkedin-id' },
      update: {},
      create: {
        linkedInId: 'dev-linkedin-id',
        email: 'devrep@leegality.com',
        name: 'Dev Sales Rep',
        accessToken: encrypt('dev-fake-token'),
        tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    });
    req.session.userId = rep.id;
    req.session.userType = 'rep';
    res.redirect(clientRedirect('/rep/queue'));
  });
}

// ─── Logout ──────────────────────────────────────────────────

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Failed to logout' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

export default router;
