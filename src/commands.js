import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

export function buildBirdCommand() {
  return new SlashCommandBuilder()
    .setName('bird')
    .setDescription('Schedule and post random birds with facts')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('post')
        .setDescription('Start bird posts on an interval')
        .addStringOption((option) =>
          option
            .setName('interval')
            .setDescription('How often to post')
            .setRequired(true)
            .addChoices(
              { name: 'Every hour', value: 'hourly' },
              { name: 'Every 12 hours', value: 'twelve_hours' },
              { name: 'Once a day', value: 'daily' },
            ),
        )
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Channel to post birds in').setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('stop')
        .setDescription('Stop bird posts for the current guild')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Channel to stop for').setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('now')
        .setDescription('Post one bird immediately')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Channel to post in').setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Show the current bird post schedule')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Channel to inspect').setRequired(false),
        ),
    )
    .toJSON();
}

export async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    throw new Error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID');
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const commands = [buildBirdCommand()];

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    return { scope: 'guild', guildId };
  }

  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  return { scope: 'global' };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  registerCommands()
    .then((result) => {
      const scope = result.scope === 'guild' ? `guild ${result.guildId}` : 'global';
      console.log(`Registered commands for ${scope}`);
    })
    .catch((error) => {
      console.error('Failed to register commands');
      console.error(error);
      process.exitCode = 1;
    });
}