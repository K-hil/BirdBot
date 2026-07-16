import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
} from 'discord.js';
import {
  BIRD_INTERVALS,
  getIntervalConfig,
  getRandomBirdFact,
  loadBirdTaxonomy,
  loadSchedules,
  pickRandomBird,
  resolveSchedulesPath,
  resolveTaxonomyPath,
  saveSchedules,
  fetchWikipediaBirdInfo,
} from './utils.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schedulesPath = resolveSchedulesPath(path.join(__dirname, '..', 'data', 'schedules.json'));
const taxonomyPath = resolveTaxonomyPath(path.join(__dirname, '..', 'data', 'ebird-taxonomy.json'));
const port = Number(process.env.PORT ?? 8080);
const scheduleState = new Map();
console.log('BirdBot booting');
console.log(`Schedules file: ${schedulesPath}`);
console.log(`Taxonomy cache: ${taxonomyPath}`);
const guildSchedules = await loadSchedules(schedulesPath);
console.log(`Loaded ${Object.keys(guildSchedules).length} saved schedule(s)`);
console.log('Loading bird taxonomy...');
const taxonomy = await loadBirdTaxonomy(taxonomyPath);
console.log(`Loaded ${taxonomy.length} bird taxonomy record(s)`);
const botStartedAt = Date.now();
const runtimeState = {
  lastBird: null,
};

function clearTimer(guildId) {
  const existing = scheduleState.get(guildId);

  if (existing?.timeout) {
    clearTimeout(existing.timeout);
  }

  scheduleState.delete(guildId);
}

async function postBird(channel) {
  const bird = pickRandomBird(taxonomy);
  const wikipediaInfo = await fetchWikipediaBirdInfo(bird.sciName);
  const fact = getRandomBirdFact();
  const embed = new EmbedBuilder()
    .setTitle(`${bird.comName} (${bird.sciName})`)
    .setDescription([wikipediaInfo.description, '', `Fact: ${fact}`].join('\n'))
    .setColor(0x8f6b3f)
    .setFooter({ text: `Wikipedia: ${wikipediaInfo.title}` })
    .setTimestamp(new Date());

  if (wikipediaInfo.imageUrl) {
    embed.setImage(wikipediaInfo.imageUrl);
  }

  if (wikipediaInfo.pageUrl) {
    embed.setURL(wikipediaInfo.pageUrl);
  }

  await channel.send({ embeds: [embed] });

  runtimeState.lastBird = {
    commonName: bird.comName,
    scientificName: bird.sciName,
    wikipediaTitle: wikipediaInfo.title,
    hasImage: Boolean(wikipediaInfo.imageUrl),
    fact,
    updatedAt: new Date().toISOString(),
  };
}

async function scheduleGuildPost(guildId, channelId, intervalKey) {
  const interval = getIntervalConfig(intervalKey);

  if (!interval) {
    throw new Error(`Unsupported interval: ${intervalKey}`);
  }

  clearTimer(guildId);

  const nextRunAt = Date.now() + interval.milliseconds;
  const timeout = setTimeout(async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel || typeof channel.send !== 'function') {
        throw new Error('Configured channel is not text based');
      }

      await postBird(channel);
    } catch (error) {
      console.error(`Failed to post scheduled bird for guild ${guildId}`);
      console.error(error);
    } finally {
      const current = guildSchedules[guildId];

      if (current) {
        await scheduleGuildPost(guildId, current.channelId, current.intervalKey);
      }
    }
  }, interval.milliseconds);

  scheduleState.set(guildId, {
    guildId,
    channelId,
    intervalKey,
    timeout,
    nextRunAt,
  });
}

async function persistSchedules() {
  await saveSchedules(schedulesPath, guildSchedules);
}

function resolveTargetChannel(interaction) {
  return interaction.options.getChannel('channel') ?? interaction.channel;
}

async function sendBirdNow(channel) {
  await postBird(channel);
}

client.on(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  for (const [guildId, config] of Object.entries(guildSchedules)) {
    await scheduleGuildPost(guildId, config.channelId, config.intervalKey);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    console.log(`Interaction received: /${interaction.commandName} in guild ${interaction.guildId ?? 'dm'}`);
  }

  if (!interaction.isChatInputCommand() || interaction.commandName !== 'bird') {
    return;
  }

  if (!interaction.guildId) {
    await interaction.reply({ content: 'Bird schedules only work inside a server.', ephemeral: true });
    return;
  }

  const guildId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'post') {
    const intervalKey = interaction.options.getString('interval', true);
    const interval = getIntervalConfig(intervalKey);
    const targetChannel = resolveTargetChannel(interaction);

    if (!targetChannel || typeof targetChannel.send !== 'function') {
      await interaction.reply({ content: 'Pick a text channel for bird posts.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    console.log(`Scheduling bird posts for guild ${guildId} in channel ${targetChannel.id} at interval ${intervalKey}`);

    guildSchedules[guildId] = {
      channelId: targetChannel.id,
      intervalKey,
    };
    await persistSchedules();
    await scheduleGuildPost(guildId, targetChannel.id, intervalKey);

    try {
      await sendBirdNow(targetChannel);
    } catch (error) {
      console.error(`Failed to send immediate bird for guild ${guildId}`);
      console.error(error);
      await interaction.editReply({
        content: `Bird posts are scheduled in ${targetChannel} ${interval?.label ?? ''}, but the first post failed.`,
      });
      return;
    }

    await interaction.editReply({
      content: `Bird posts are now scheduled in ${targetChannel} ${interval?.label ?? ''}.`,
    });
    return;
  }

  if (subcommand === 'stop') {
    const targetChannel = resolveTargetChannel(interaction);

    await interaction.deferReply({ ephemeral: true });
    console.log(`Stopping bird posts for guild ${guildId}`);

    clearTimer(guildId);
    delete guildSchedules[guildId];
    await persistSchedules();

    await interaction.editReply({
      content: `Bird posts have been stopped${targetChannel ? ` for ${targetChannel}` : ''}.`,
    });
    return;
  }

  if (subcommand === 'now') {
    const targetChannel = resolveTargetChannel(interaction);

    if (!targetChannel || typeof targetChannel.send !== 'function') {
      await interaction.reply({ content: 'Pick a text channel to post in.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    console.log(`Posting bird immediately for guild ${guildId} in channel ${targetChannel.id}`);
    try {
      await sendBirdNow(targetChannel);
    } catch (error) {
      console.error(`Failed to post bird immediately in guild ${guildId}`);
      console.error(error);
      await interaction.editReply({ content: 'I could not post a bird in that channel.' });
      return;
    }

    await interaction.editReply({ content: `Posted a bird in ${targetChannel}.` });
    return;
  }

  if (subcommand === 'status') {
    const current = guildSchedules[guildId];
    console.log(`Status requested for guild ${guildId}`);

    if (!current) {
      await interaction.reply({ content: 'No bird schedule is active for this server.', ephemeral: true });
      return;
    }

    const interval = BIRD_INTERVALS[current.intervalKey];
    const nextRun = scheduleState.get(guildId)?.nextRunAt;

    await interaction.reply({
      content: [
        `Channel: <#${current.channelId}>`,
        `Interval: ${interval?.label ?? current.intervalKey}`,
        nextRun ? `Next post: <t:${Math.floor(nextRun / 1000)}:R>` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      ephemeral: true,
    });
  }
});

client.on(Events.Error, (error) => {
  console.error('Discord client error');
  console.error(error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection');
  console.error(error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception');
  console.error(error);
});

const webServer = http.createServer((request, response) => {
  if (request.url === '/health' || request.url === '/api/health') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      ok: true,
      uptimeSeconds: Math.floor((Date.now() - botStartedAt) / 1000),
      scheduledServers: Object.keys(guildSchedules).length,
      lastBird: runtimeState.lastBird,
    }, null, 2));
    return;
  }

  const latestBird = runtimeState.lastBird
    ? `<section class="card"><h2>Latest Bird</h2><p><strong>${runtimeState.lastBird.commonName}</strong> (${runtimeState.lastBird.scientificName})</p><p>Wikipedia: ${runtimeState.lastBird.wikipediaTitle}</p><p>${runtimeState.lastBird.fact}</p><p>Updated: ${runtimeState.lastBird.updatedAt}</p></section>`
    : '<section class="card"><h2>Latest Bird</h2><p>No bird has been posted yet.</p></section>';

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>BirdBot</title>
      <style>
        :root { color-scheme: light; }
        body { font-family: Arial, sans-serif; margin: 0; background: linear-gradient(135deg, #f9f5ef, #edf5ff); color: #1f2937; }
        main { max-width: 900px; margin: 0 auto; padding: 32px 20px 48px; }
        .hero { background: white; border-radius: 20px; padding: 28px; box-shadow: 0 18px 50px rgba(0,0,0,0.08); margin-bottom: 20px; }
        .card { background: rgba(255,255,255,0.9); border-radius: 16px; padding: 20px; margin-bottom: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
        h1, h2 { margin-top: 0; }
        code { background: #eef2ff; padding: 2px 6px; border-radius: 6px; }
      </style>
    </head>
    <body>
      <main>
        <section class="hero">
          <h1>BirdBot is running</h1>
          <p>Discord bot status: ${client.user ? `logged in as ${client.user.tag}` : 'starting up'}</p>
          <p>Open <code>/health</code> for JSON status.</p>
        </section>
        <section class="card">
          <h2>Status</h2>
          <p>Uptime: ${Math.floor((Date.now() - botStartedAt) / 1000)} seconds</p>
          <p>Scheduled servers: ${Object.keys(guildSchedules).length}</p>
          <p>Web port: ${port}</p>
        </section>
        ${latestBird}
      </main>
    </body>
  </html>`;

  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
});

webServer.listen(port, () => {
  console.log(`Web server listening on http://localhost:${port}`);
});

if (!process.env.DISCORD_TOKEN) {
  throw new Error('Missing DISCORD_TOKEN');
}

client.login(process.env.DISCORD_TOKEN);