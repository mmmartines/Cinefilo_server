import { z } from 'zod';

// Shared
export const idSchema = z.string().uuid("ID inválido");

// Users
export const updateUserSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(100).optional(),
  nickname: z.string().optional().nullable(),
  avatar_url: z.string().url("URL de avatar inválida").optional().nullable(),
  email: z.string().email("Email inválido").optional(),
  birthdate: z.string().optional().nullable(),
  password: z.string().min(6).optional().nullable()
});

// Feed
export const createFeedItemSchema = z.object({
  id: z.string().optional(),
  movie_id: z.number(),
  movie_title: z.string(),
  movie_poster: z.string().optional().nullable(),
  action: z.enum(['watched', 'liked', 'reviewed', 'challenge_completed']),
  rating: z.number().min(0).max(5).optional().nullable(),
  review: z.string().optional().nullable(),
  has_spoiler: z.boolean().optional(),
  emotions: z.array(z.string()).optional(),
  created_at: z.string().optional(),
});

// Sync Payload
export const syncPayloadSchema = z.object({
  total_movies: z.number().min(0),
  total_minutes: z.number().min(0),
  watched_movies: z.array(z.any()).optional(),
  avatar_url: z.string().url("URL de avatar inválida").optional().nullable(),
  expo_push_token: z.string().optional().nullable(),
  notifications_enabled: z.boolean().optional(),
  completed_challenges: z.array(z.string()).optional(),
  bonus_xp: z.number().min(0).optional(),
  level: z.number().min(1).optional(),
  xp: z.number().min(0).optional(),
  last_updated: z.string().optional(),
  favorite_genres: z.array(z.number()).optional(),
  favorite_providers: z.array(z.number()).optional()
});
