import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

export const BIRD_INTERVALS = {
  hourly: {
    label: 'every hour',
    milliseconds: 60 * 60 * 1000,
  },
  twelve_hours: {
    label: 'every 12 hours',
    milliseconds: 12 * 60 * 60 * 1000,
  },
  daily: {
    label: 'once a day',
    milliseconds: 24 * 60 * 60 * 1000,
  },
};

export const BIRD_FACTS = [
  'Birds are the only living dinosaurs.',
  'A group of flamingos is called a flamboyance.',
  'Owls can rotate their necks up to 270 degrees.',
  'Penguins are birds that cannot fly but are excellent swimmers.',
  'Hummingbirds are the only birds that can fly backward.',
  'Some bird species sleep with one half of their brain at a time.',
  'Crows are among the most intelligent bird species.',
  'The ostrich is the largest living bird.',
  'Bird feathers are made of keratin, the same protein as human hair and nails.',
  'Albatrosses can spend years at sea without touching land.',
];

export function getIntervalConfig(intervalKey) {
  return BIRD_INTERVALS[intervalKey] ?? null;
}

export function getRandomBirdFact() {
  return BIRD_FACTS[Math.floor(Math.random() * BIRD_FACTS.length)];
}

export async function fetchRandomBirdImage() {
  const response = await fetch('https://random-d.uk/api/random');

  if (!response.ok) {
    throw new Error(`Bird image request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!data?.url) {
    throw new Error('Bird image response did not include a url');
  }

  return data.url;
}

export async function fetchBirdDrop() {
  const [imageUrl, fact] = await Promise.all([
    fetchRandomBirdImage(),
    Promise.resolve(getRandomBirdFact()),
  ]);

  return { imageUrl, fact };
}

export function resolveSchedulesPath(customPath) {
  return path.resolve(customPath ?? process.env.BIRD_SCHEDULES_FILE ?? './data/schedules.json');
}

export async function loadSchedules(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

export async function saveSchedules(filePath, schedules) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(schedules, null, 2));
}