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

export function getScheduleKind(schedule) {
  if (schedule?.kind) {
    return schedule.kind;
  }

  if (schedule?.times) {
    return 'fixed_times';
  }

  return 'interval';
}

export function getScheduleLabel(schedule) {
  if (!schedule) {
    return 'unknown schedule';
  }

  if (getScheduleKind(schedule) === 'fixed_times') {
    return formatDailyTimesLabel(schedule.times);
  }

  const interval = getIntervalConfig(schedule.intervalKey);
  return interval?.label ?? schedule.intervalKey ?? 'unknown schedule';
}

export function resolveSchedulesPath(customPath) {
  return path.resolve(customPath ?? process.env.BIRD_SCHEDULES_FILE ?? './data/schedules.json');
}

export function resolveBirdCatalogPath(customPath) {
  return path.resolve(customPath ?? process.env.BIRD_CATALOG_FILE ?? './data/birds.json');
}

export function resolveAnimalFactsPath(customPath) {
  return path.resolve(customPath ?? process.env.ANIMAL_FACTS_FILE ?? './data/animal-fun-facts-dataset.csv');
}

function parseCsvContent(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (character === '\r') {
      continue;
    }

    field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeAnimalFactRow(row) {
  const fact = row?.text?.trim();

  if (!fact) {
    return null;
  }

  return fact.replace(/\s+/g, ' ');
}

export async function loadAnimalFacts(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const rows = parseCsvContent(content);

  if (rows.length < 2) {
    throw new Error('Animal facts CSV did not contain any data');
  }

  const [headers, ...dataRows] = rows;
  const normalizedHeaders = headers.map((header) => header.trim());
  const facts = dataRows
    .map((values) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] ?? ''])))
    .map(normalizeAnimalFactRow)
    .filter(Boolean);

  if (facts.length === 0) {
    throw new Error('Animal facts CSV did not contain any usable facts');
  }

  return facts;
}

export function getRandomBirdFact(facts = BIRD_FACTS) {
  return facts[Math.floor(Math.random() * facts.length)];
}

function parseTimePart(timePart) {
  const trimmed = timePart.trim().toLowerCase();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);

  if (!match) {
    throw new Error(`Invalid time value: ${timePart}`);
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const meridiem = match[3]?.toLowerCase() ?? null;

  if (minute < 0 || minute > 59) {
    throw new Error(`Invalid minute value in: ${timePart}`);
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      throw new Error(`Invalid 12-hour clock value: ${timePart}`);
    }

    if (meridiem === 'am') {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
  } else if (hour < 0 || hour > 23) {
    throw new Error(`Invalid 24-hour clock value: ${timePart}`);
  }

  return hour * 60 + minute;
}

export function parseDailyTimesInput(input) {
  const values = input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseTimePart);

  const uniqueValues = [...new Set(values)].sort((left, right) => left - right);

  if (uniqueValues.length === 0) {
    throw new Error('Please provide at least one valid time.');
  }

  return uniqueValues;
}

function formatTimeOfDay(minutes) {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatDailyTimesLabel(times) {
  if (!Array.isArray(times) || times.length === 0) {
    return 'every day at an unknown time';
  }

  return `every day at ${times.map(formatTimeOfDay).join(' and ')}`;
}

export function computeNextRunAt(schedule, now = Date.now()) {
  if (!schedule) {
    throw new Error('Missing schedule definition');
  }

  const scheduleKind = getScheduleKind(schedule);

  if (scheduleKind === 'fixed_times') {
    const times = Array.isArray(schedule.times) ? [...schedule.times].sort((left, right) => left - right) : [];

    if (times.length === 0) {
      throw new Error('No times were provided for the daily schedule');
    }

    const currentTime = new Date(now);

    for (const minutes of times) {
      const candidate = new Date(currentTime);
      candidate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

      if (candidate.getTime() > now) {
        return candidate.getTime();
      }
    }

    const nextDay = new Date(currentTime);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(Math.floor(times[0] / 60), times[0] % 60, 0, 0);
    return nextDay.getTime();
  }

  const interval = getIntervalConfig(schedule.intervalKey);

  if (!interval) {
    throw new Error(`Unsupported interval: ${schedule.intervalKey}`);
  }

  return now + interval.milliseconds;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function normalizeBirdSource(bird) {
  if (!bird || typeof bird !== 'object') {
    return null;
  }

  const commonName = bird.common_name ?? bird.commonName ?? null;
  const scientificName = bird.scientific_name ?? bird.scientificName ?? null;

  if (!commonName || !scientificName) {
    return null;
  }

  const imageUrl = bird.male_image ?? bird.female_image ?? bird.other_images?.[0]?.source ?? null;
  const sourceUrl = bird.sources ?? null;

  const normalizeUrl = (value) => {
    if (!value) {
      return null;
    }

    return value.startsWith('//') ? `https:${value}` : value;
  };

  return {
    id: bird.id ?? null,
    commonName,
    scientificName,
    imageUrl: normalizeUrl(imageUrl),
    conservationStatus: bird.conservation_status ?? null,
    description: bird.description ?? 'No description available.',
    sourceUrl: normalizeUrl(sourceUrl),
    soundUrl: bird.sound ?? null,
    raw: bird,
  };
}

function normalizeBirdCatalog(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeBirdSource).filter(Boolean);
}

export async function loadBirdCatalog(filePath) {
  if (await fileExists(filePath)) {
    console.log(`Loading cached bird catalog from ${filePath}`);
    const content = await fs.readFile(filePath, 'utf8');
    return normalizeBirdCatalog(JSON.parse(content));
  }

  const catalogUrl = process.env.BIRD_CATALOG_URL ?? 'https://ornithophile.vercel.app/api/birds';

  console.log(`Downloading bird catalog from ${catalogUrl}`);
  const response = await fetch(catalogUrl);

  if (!response.ok) {
    throw new Error(`Bird catalog request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Bird catalog response did not contain an array');
  }

  const catalog = normalizeBirdCatalog(data);

  if (catalog.length === 0) {
    throw new Error('Bird catalog did not contain any usable bird objects');
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved bird catalog cache to ${filePath}`);

  return catalog;
}

export function pickRandomBird(catalog) {
  const pool = Array.isArray(catalog) ? catalog.filter((bird) => bird?.commonName && bird?.scientificName) : [];

  if (pool.length === 0) {
    throw new Error('No birds were found in the bird catalog');
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export function formatBirdCaption(bird) {
  if (!bird) {
    return 'No bird data available.';
  }

  const parts = [];

  if (bird.conservationStatus) {
    parts.push(`Status: ${bird.conservationStatus}`);
  }

  if (bird.soundUrl != undefined) {
    parts.push(`Sound: ${bird.soundURL}`);
  }

  return parts.filter(Boolean).join('\n\n');
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