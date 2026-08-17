import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

export const adminRouter = Router();

// Host-only administrative protected endpoint
adminRouter.get(
  '/host-only',
  requireAuth,
  requireRole('host_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      message: 'Access granted to host administration portal',
      adminUser: req.user,
      systemMetrics: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        kernelStatus: 'OPERATIONAL',
        activeMiniApps: ['wev.sports', 'wev.care', 'wev.events'],
      },
    });
  }
);

adminRouter.get('/health', async (_req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});
