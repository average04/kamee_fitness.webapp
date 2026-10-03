import { expect, it } from 'vitest';
import { buildFeed } from './feed';
import { summarizeWorkouts, workoutTimeDisplay } from './workouts';
import { resolveWindow } from './range';
import type { WorkoutSessionRow, TrackSessionRow } from './queries';

const row = (id: string, end: string, past = false, submitted = '2026-10-04T00:00:00Z'): WorkoutSessionRow => ({
  id, source: 'freestyle', performed_date: '2026-10-03', timestamp_precision: past ? 'date' : 'instant', entry_mode: past ? 'past' : 'live',
  started_at: end, ended_at: end, submitted_at: submitted, duration_seconds: null, status: 'completed', avg_hr: null, day_id: null,
});
it('orders mixed live GPS planned and date-only by day, actual finish, submission and stable ID', () => {
  const workouts = [row('morning', '2026-10-03T08:00:00Z'), row('late', '2026-10-03T18:00:00Z'),
    row('z-past', '2026-10-02T22:00:00Z', true), row('a-past', '2026-10-02T22:00:00Z', true),
    row('older-past', '2026-10-04T00:00:00Z', true, '2026-10-03T00:00:00Z'),
    { ...row('planned', '2026-10-03T09:00:00Z'), source: 'planned' as const, performed_date: null }];
  const track = { id: 'gps', mode: 'run', finished_at: '2026-10-03T07:00:00Z', created_at: '2026-10-03T07:00:00Z', duration_seconds: 600, distance_meters: 1000, route_points: [] } as TrackSessionRow;
  expect(buildFeed(workouts, [], [track], {}, 20).map((i) => i.id)).toEqual(['late','planned','morning','gps','a-past','z-past','older-past']);
  expect(buildFeed([...workouts].reverse(), [], [track], {}, 20).map((i) => i.id)).toEqual(['late','planned','morning','gps','a-past','z-past','older-past']);
  expect(buildFeed(workouts, [], [], {}, 20).find((i) => i.id === 'a-past')?.dateIso).toBe('2026-10-03');
});
it('summaries retain missing count for wholly unknown and partial recorded time', () => {
  const unknown = row('unknown', '2026-10-02T22:00:00Z', true);
  const window = resolveWindow('all', new Date('2026-10-04'));
  expect(summarizeWorkouts([unknown], [], {}, null, window)).toMatchObject({ timeTrainedSeconds: 0, missingDurationCount: 1 });
  expect(summarizeWorkouts([unknown, { ...row('known','2026-10-03T18:00:00Z'), duration_seconds: 1800 }], [], {}, null, window)).toMatchObject({ timeTrainedSeconds: 1800, missingDurationCount: 1 });
  expect(workoutTimeDisplay(summarizeWorkouts([unknown], [], {}, null, window), (s) => `${s / 60}m`)).toEqual({ label: 'Time recorded', value: 'Not recorded', sub: '1 workout without duration' });
  expect(workoutTimeDisplay(summarizeWorkouts([unknown, { ...unknown, id: 'known', duration_seconds: 1800 }], [], {}, null, window), (s) => `${s / 60}m`)).toEqual({ label: 'Time recorded', value: '30m', sub: '1 workout without duration' });
});
