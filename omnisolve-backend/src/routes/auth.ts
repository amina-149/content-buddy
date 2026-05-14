import express from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { getDatabaseClient } from '@/config/database';
import { config } from '@/config/env';
import { credentialService } from '@/services/credentialService';
import { logger } from '@/utils/logger';

const router = express.Router();

// User registration
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const db = getDatabaseClient();

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcryptjs.hash(password, 10);
    
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName
      }
    });

    const token = jwt.sign({ userId: user.id }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN
    });

    res.json({ user, token });
  } catch (error) {
    next(error);
  }
});

// User login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const db = getDatabaseClient();

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcryptjs.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN
    });

    res.json({ user, token });
  } catch (error) {
    next(error);
  }
});

// OAuth callbacks
router.get('/youtube/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const userId = state as string;

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: config.YOUTUBE_CLIENT_ID,
      client_secret: config.YOUTUBE_CLIENT_SECRET,
      redirect_uri: config.YOUTUBE_CALLBACK_URL,
      grant_type: 'authorization_code'
    });

    const db = getDatabaseClient();
    const credential = await db.platformCredential.upsert({
      where: { userId_platform: { userId, platform: 'YOUTUBE' } },
      update: {
        accessToken: credentialService.encryptOAuthToken(tokenResponse.data),
        expiresAt: new Date(Date.now() + tokenResponse.data.expires_in * 1000),
        isActive: true
      },
      create: {
        userId,
        platform: 'YOUTUBE',
        accessToken: credentialService.encryptOAuthToken(tokenResponse.data),
        expiresAt: new Date(Date.now() + tokenResponse.data.expires_in * 1000),
        scopes: ['youtube.upload', 'youtube.readonly']
      }
    });

    res.redirect(`${config.API_BASE_URL}/dashboard?connected=youtube`);
  } catch (error) {
    logger.error('YouTube OAuth error:', error);
    res.status(500).json({ error: 'OAuth failed' });
  }
});

// Similar patterns for Instagram and TikTok...

export default router;
