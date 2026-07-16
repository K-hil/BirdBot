# BirdBot

BirdBot posts a random bird from a cached eBird taxonomy file, then looks up the bird on Wikipedia for a photo and description.

## Quick Start

1. Copy `.env.example` to `.env` and fill in your Discord token, client ID, and eBird API key.
2. Install dependencies with `npm install`.
3. Register commands with `npm run register`.
4. Start the bot with `npm start`.

On first run, the bot downloads the eBird taxonomy JSON and saves it to `data/ebird-taxonomy.json`. Later runs reuse that file.

## Commands

- `/bird post interval:<hourly|twelve_hours|daily> [channel]` starts a schedule and posts immediately.
- `/bird stop [channel]` stops the schedule.
- `/bird now [channel]` posts a bird right away.
- `/bird status` shows the active schedule.

## Files

- `src/` contains the bot source.
- `data/` stores saved schedules.
- `Dockerfile` and `docker-compose.yml` are ready for container deployment.

## GitHub Actions

- `.github/workflows/ci.yml` runs the smoke test on pull requests and pushes to `main`.
- `.github/workflows/deploy.yml` builds and publishes the Docker image to GitHub Container Registry as `ghcr.io/<owner>/<repo>`.
