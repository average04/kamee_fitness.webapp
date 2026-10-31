// Generated from src/lib/coaching/enrollmentTypes.ts; run the app sync-coaching-conversation-client script. Do not edit.
import { z } from 'zod';

export const enrollmentUuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .length(36)
  .transform((v) => v.toLowerCase());

export const enrollmentDate = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  .length(10)
  .refine((v) => {
    const y = Number(v.slice(0, 4));
    const d = new Date(v + 'T00:00:00Z');
    return y >= 100 && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
