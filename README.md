# BirdBot

BirdBot posts a random bird image and a random bird fact on a schedule you choose from slash commands.

## Quick Start

1. Copy `.env.example` to `.env` and fill in your Discord token and client ID.
2. Install dependencies with `npm install`.
3. Register commands with `npm run register`.
4. Start the bot with `npm start`.

## Commands

- `/bird post interval:<hourly|twelve_hours|daily> [channel]` starts a schedule and posts immediately.
- `/bird stop [channel]` stops the schedule.
- `/bird now [channel]` posts a bird right away.
- `/bird status` shows the active schedule.

## Files

- `src/` contains the bot source.
- `data/` stores saved schedules.
- `Dockerfile` and `docker-compose.yml` are ready for container deployment.
