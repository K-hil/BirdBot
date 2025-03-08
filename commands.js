import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command To Display Bird Picture from API call
const RANDOM_BIRD_COMMAND = {
  name: 'rb',
  description: 'Display a random bird picture',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const ALL_COMMANDS = [TEST_COMMAND, RANDOM_BIRD_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
