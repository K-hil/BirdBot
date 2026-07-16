import 'dotenv/config';
import {
  fetchWikipediaBirdInfo,
  loadBirdTaxonomy,
  pickRandomBird,
  resolveTaxonomyPath,
} from './utils.js';

const taxonomy = await loadBirdTaxonomy(resolveTaxonomyPath('./data/ebird-taxonomy.json'));
const bird = pickRandomBird(taxonomy);
const wiki = await fetchWikipediaBirdInfo(bird.sciName);

console.log(JSON.stringify({
  commonName: bird.comName,
  scientificName: bird.sciName,
  wikiTitle: wiki.title,
  hasImage: Boolean(wiki.imageUrl),
  Image: wiki.imageUrl || "NOURL",
  description: wiki.description,
}, null, 2));