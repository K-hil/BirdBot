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

export function resolveSchedulesPath(customPath) {
  return path.resolve(customPath ?? process.env.BIRD_SCHEDULES_FILE ?? './data/schedules.json');
}

export function resolveTaxonomyPath(customPath) {
  return path.resolve(customPath ?? process.env.BIRD_TAXONOMY_FILE ?? './data/ebird-taxonomy.json');
}

export function getRandomBirdFact() {
  return BIRD_FACTS[Math.floor(Math.random() * BIRD_FACTS.length)];
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

export async function loadBirdTaxonomy(filePath) {
  if (await fileExists(filePath)) {
    console.log(`Loading cached bird taxonomy from ${filePath}`);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  const apiKey = process.env.EBIRD_API_KEY;

  if (!apiKey) {
    throw new Error('Missing EBIRD_API_KEY');
  }

  console.log('Downloading bird taxonomy from eBird');
  const response = await fetch('https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json', {
    headers: {
      'X-eBirdApiToken': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`eBird taxonomy request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('eBird taxonomy response did not contain an array');
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved bird taxonomy cache to ${filePath}`);

  return data;
}

export function pickRandomBird(taxonomy) {
  const speciesOnly = taxonomy.filter((bird) => bird?.category === 'species' && bird?.comName && bird?.sciName);
  const pool = speciesOnly.length > 0 ? speciesOnly : taxonomy.filter((bird) => bird?.comName && bird?.sciName);

  if (pool.length === 0) {
    throw new Error('No birds were found in the taxonomy file');
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export async function fetchWikipediaBirdInfo(scientificName) {
  const searchUrl = new URL('https://en.wikipedia.org/w/api.php');
  searchUrl.searchParams.set('action', 'query');
  searchUrl.searchParams.set('list', 'search');
  searchUrl.searchParams.set('srsearch', scientificName);
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('origin', '*');

  const searchResponse = await fetch(searchUrl);

  if (!searchResponse.ok) {
    throw new Error(`Wikipedia search request failed with status ${searchResponse.status}`);
  }

  const searchData = await searchResponse.json();
  const pageTitle = searchData?.query?.search?.[0]?.title;

  if (!pageTitle) {
    throw new Error(`No Wikipedia page found for ${scientificName}`);
  }

  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
  const summaryResponse = await fetch(summaryUrl);

  if (!summaryResponse.ok) {
    throw new Error(`Wikipedia summary request failed with status ${summaryResponse.status}`);
  }

  const summary = await summaryResponse.json();

  return {
    title: summary.title ?? pageTitle,
    description: summary.extract ?? summary.description ?? 'No description available.',
    imageUrl: summary.originalimage?.source ?? summary.thumbnail?.source ?? null,
    pageUrl: summary?.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replaceAll(' ', '_'))}`,
  };
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