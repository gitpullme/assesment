import { Router, Response } from 'express';
import { z } from 'zod';
import { BookingService, ConflictError } from '../services/booking.service';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.middleware';

export const sportsRouter = Router();

const bookingSchema = z.object({
  activityId: z.string().min(1),
  simulateConflict: z.boolean().optional(),
});

sportsRouter.get('/activities', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.sub;
    const activities = await BookingService.listSportsActivities(currentUserId);
    res.status(200).json({ activities });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

sportsRouter.post('/bookings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = bookingSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
      return;
    }

    const { activityId, simulateConflict } = parseResult.data;
    const userId = req.user!.sub;

    const result = await BookingService.bookSportsActivity(
      activityId,
      userId,
      simulateConflict ?? false
    );

    res.status(201).json({ booking: result });
  } catch (err) {
    if (err instanceof ConflictError) {
      res.status(409).json({
        error: 'Conflict',
        message: err.message,
        code: 'CAPACITY_FULL_OR_DOUBLE_BOOKING',
      });
      return;
    }
    const message = (err as Error).message;
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: message });
  }
});
