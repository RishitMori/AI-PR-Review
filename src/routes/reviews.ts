import { Router } from 'express';
import { getReviewDetail, listRecentReviews } from '../db/queries.js';

export const reviewsRouter = Router();

reviewsRouter.get('/api/reviews', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const reviews = await listRecentReviews(limit);
    res.json({ reviews });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.get('/api/reviews/:id', async (req, res, next) => {
  try {
    const review = await getReviewDetail(Number(req.params.id));
    if (!review) return res.status(404).json({ error: 'Review not found.' });
    return res.json({ review });
  } catch (error) {
    next(error);
  }
});
