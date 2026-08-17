import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['guest', 'member', 'host_admin']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
      return;
    }
    const { email, password, firstName, lastName, role } = parseResult.data;
    const session = await AuthService.register(email, password, firstName, lastName, role ?? 'member');
    res.status(201).json(session);
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes('already registered') ? 409 : 500;
    res.status(status).json({ error: message });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
      return;
    }
    const { email, password } = parseResult.data;
    const session = await AuthService.login(email, password);
    res.status(200).json(session);
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
});

authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const parseResult = refreshSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
      return;
    }
    const { refreshToken } = parseResult.data;
    const tokens = await AuthService.refreshSession(refreshToken);
    res.status(200).json(tokens);
  } catch (err) {
    res.status(401).json({ error: (err as Error).message, code: 'REFRESH_FAILED' });
  }
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await AuthService.getUserById(req.user.sub);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
