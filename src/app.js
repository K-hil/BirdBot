import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
} from 'discord.js';
import { registerCommands } from './commands.js';
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
const scheduleState = new Map();
const guildSchedules = await loadSchedules(schedulesPath);
const taxonomy = await loadBirdTaxonomy(taxonomyPath);

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

  try {
    await registerCommands();
    console.log('Slash commands registered');
  } catch (error) {
    console.error('Failed to register slash commands');
    console.error(error);
  }

  for (const [guildId, config] of Object.entries(guildSchedules)) {
    await scheduleGuildPost(guildId, config.channelId, config.intervalKey);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
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

if (!process.env.DISCORD_TOKEN) {
  throw new Error('Missing DISCORD_TOKEN');
}

client.login(process.env.DISCORD_TOKEN);