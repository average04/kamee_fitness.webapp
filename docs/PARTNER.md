# Kamee Partner API — Training-Plan Catalog

Read-only JSON feed of Kamee's published training plans.

- **Endpoint:** `GET https://kamee.fit/api/plans`
- **Auth:** required header `X-Api-Key: <your key>` (provided by Kamee; keep it server-side, never in client-visible code)
- **Query params:** `discipline` (optional) — `strength` or `running`. Any other value returns `400`. All other params are ignored.
- **Caching:** responses are CDN-cached — treat the feed as eventually consistent. Changes typically appear within an hour, but a stale copy can be served for up to a day after a change while the cache revalidates in the background.

## Example request

```sh
curl -H "X-Api-Key: $KAMEE_API_KEY" "https://kamee.fit/api/plans?discipline=running"
```

## Example response

```json
{
  "generatedAt": "2026-07-17T12:00:00.000Z",
  "plans": [
    {
      "id": "3f2c8a1e-6b7d-4e9f-a1b2-c3d4e5f60718",
      "title": "Couch to 5K",
      "summary": "Nine weeks from the couch to your first 5K.",
      "coverUrl": "https://ywkqixaobbjxdncvnqav.supabase.co/storage/v1/object/public/plan-covers/couch-to-5k.jpg",
      "level": "beginner",
      "discipline": "running",
      "disciplineLabel": "Outdoor",
      "weeksCount": 9,
      "daysPerWeek": 3,
      "estMinutesPerSession": 30,
      "webUrl": "https://kamee.fit/plans/3f2c8a1e-6b7d-4e9f-a1b2-c3d4e5f60718",
      "appUrl": "kamee://plan/3f2c8a1e-6b7d-4e9f-a1b2-c3d4e5f60718"
    }
  ]
}
```

Field notes: `level` is one of `none | beginner | intermediate | advanced`; `coverUrl`, `summary`, `daysPerWeek`, and `estMinutesPerSession` may be `null`. `disciplineLabel` is the display name (`Workouts` for strength, `Outdoor` for running).

Linking: `webUrl` is always safe to render — it opens the plan's page on kamee.fit, which itself offers app and store links. `appUrl` is a deep link that opens the plan inside the Kamee app; it only works on a device with the app installed and does nothing elsewhere, so prefer `webUrl` unless you know the app is present.

## Errors

All errors are JSON with a generic `error` message: `400` invalid discipline, `401` missing/wrong key, `405` non-GET method.
