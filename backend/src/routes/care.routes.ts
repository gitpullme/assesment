import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { BookingService } from '../services/booking.service';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';

export const careRouter = Router();

const createCareBookingSchema = z.object({
  providerId: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional(),
});

careRouter.get('/providers', async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;

    const userLocation = lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)
      ? { lat, lng }
      : undefined;

    const providers = await BookingService.listCareProviders(userLocation);
    res.status(200).json({ providers });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

careRouter.post('/bookings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = createCareBookingSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
      return;
    }

    const { providerId, startTime, endTime, notes } = parseResult.data;
    const userId = req.user!.sub;

    const result = await BookingService.bookCareProvider(providerId, userId, startTime, endTime, notes);
    res.status(201).json({ booking: result });
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: message });
  }
});

careRouter.get('/bookings/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.id;
    if (!bookingId) {
      res.status(400).json({ error: 'Booking ID required' });
      return;
    }
    const userId = req.user!.sub;

    const booking = await BookingService.getCareBooking(bookingId, userId);
    res.status(200).json({ booking });
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: message });
  }
});

careRouter.post('/bookings/:id/confirm', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.id;
    if (!bookingId) {
      res.status(400).json({ error: 'Booking ID required' });
      return;
    }
    const userId = req.user!.sub;

    const booking = await BookingService.confirmCareBooking(bookingId, userId);
    res.status(200).json({ booking });
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: message });
  }
});
