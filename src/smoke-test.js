import 'dotenv/config';
import { loadBirdCatalog, pickRandomBird, resolveBirdCatalogPath } from './utils.js';

const catalog = await loadBirdCatalog(resolveBirdCatalogPath('./data/birds.json'));
const bird = pickRandomBird(catalog);

console.log(JSON.stringify({
  commonName: bird.commonName,
  scientificName: bird.scientificName,
  hasImage: Boolean(bird.imageUrl),
  imageUrl: bird.imageUrl ?? 'NOURL',
  conservationStatus: bird.conservationStatus,
  description: bird.description,
  sourceUrl: bird.sourceUrl,
}, null, 2));