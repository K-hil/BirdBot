# BirdBot

BirdBot posts a random bird from a cached eBird taxonomy file, then looks up the bird on Wikipedia for a photo and description.

## Quick Start

1. Copy `.env.example` to `.env` and fill in your Discord token, client ID, and eBird API key.
2. Install dependencies with `npm install`.
3. Register commands with `npm run register`.
4. Start the bot with `npm start`.

On first run, the bot downloads the eBird taxonomy JSON and saves it to `data/ebird-taxonomy.json`. Later runs reuse that file.
If you use the fixed-time schedule, set `TZ` in `.env` so times like `7am` and `7pm` match your local timezone.

## Run With Docker

Use Docker Compose from the repo root:

```bash
docker compose up --build -d
```

The container runs `npm run register` first and then starts the bot. The service restarts automatically unless stopped, and the cached bird data is stored in the named volume `birdbot-data`.

Open the local status page at <http://localhost:8080>.

Check JSON health data at <http://localhost:8080/health>.

To stop it later:

```bash
docker compose down
```

## Commands

- `/bird post interval:<hourly|twelve_hours|daily> [channel]` starts a schedule and posts immediately.
- `/bird times times:<7am,7pm|07:00,19:00> [channel]` posts every day at the selected times and uses `TZ` from `.env`.
- `/bird stop [channel]` stops the schedule.
- `/bird now [channel]` posts a bird right away.
- `/bird status` shows the active schedule.

## Files

- `src/` contains the bot source.
- `data/` stores saved schedules when running locally.
- `Dockerfile` and `docker-compose.yml` are ready for container deployment.
