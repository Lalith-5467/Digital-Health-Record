import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  searchHealthShortsController,
  getHealthShortsFeedController,
  getHealthShortsSuggestionsController,
  getVideoInteractionController,
  upsertVideoInteractionController,
  getVideoCommentsController,
  postVideoCommentController,
} from '../controllers/healthShorts.controller';

const router = Router();
router.use(authenticate);

// Real-time YouTube-style search autocomplete suggestions
router.get('/suggest', getHealthShortsSuggestionsController);

// Dynamic Search endpoint
router.get('/search', searchHealthShortsController);

// Dynamic Feed endpoint
router.get('/feed', getHealthShortsFeedController);

// Engagement: Likes, Saves, Watch Progress & Comments persisted in MySQL
router.get('/:videoId/interact', getVideoInteractionController);
router.post('/:videoId/interact', upsertVideoInteractionController);
router.get('/:videoId/comments', getVideoCommentsController);
router.post('/:videoId/comments', postVideoCommentController);

// Default GET endpoint
router.get('/', searchHealthShortsController);

export default router;
