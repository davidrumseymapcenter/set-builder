// gap-analysis.js
const https = require('https');
const http = require('http');

// YOUR CURRENT FALLBACK CHAINS (copied from your script.js lines 286-318)
const CURRENT_FALLBACKS = {
  date: [
    'Date', 'Issued', 'Created', 'Date made', 'Published', 
    'Created Published', 'Associated date', 'Publication Date'
  ],
  author: [
    'Creator', 'Contributors', 'Author', 'Contributor', 
    'Publisher', 'Artist/Maker'
  ],
  collection: [
    'Location', 'Collection', 'Relation', 'Data Source', 'Contributor'
  ],
  attribution: [
    'Repository', 'Digital Publisher'
  ]
};

// YOUR 50 MANIFEST URLs - REPLACE THIS ARRAY WITH YOUR URLs
const manifestUrls = [
  'https://iiif.archivelab.org/iiif/gri_33125008447371/manifest.json',
  'https://purl.stanford.edu/hs631zg4177/iiif/manifest',
  'https://figgy.princeton.edu/concern/scanned_maps/a3a43786-f2d0-4715-8588-b01a9df63519/manifest',
  'https://digicoll.lib.berkeley.edu/nanna/proxy/iiif/manifest/154193/',
  'https://cdn1.historyit.com/iiif/5f34291499c4a6.60628694-110549/manifest',
  'https://www.loc.gov/item/2005625339/manifest.json',
  'https://cudl.lib.cam.ac.uk//iiif/PH-PEMBROKE-SPEC-STOR',
  'https://www.davidrumsey.com/luna/servlet/iiif/m/RUMSEY~8~1~375532~90141858/manifest',
'https://gallica.bnf.fr/iiif/ark:/12148/btv1b53171153s/manifest.json',
'https://purl.stanford.edu/wk210cf6868/iiif/manifest',
'https://iiif.lib.harvard.edu/manifests/ids:7115721',
'https://iiif.library.ucla.edu/ark%3A%2F21198%2Fzz00096fzh/manifest',
'https://collections.library.yale.edu/manifests/15483342',
'https://ark.digitalcommonwealth.org/ark:/50959/wd3761121/manifest',
'https://media.getty.edu/iiif/manifest/46eb79a4-b25a-4453-997f-d7f5a03e1de2',
'https://repository.library.brown.edu/iiif/presentation/bdr:42007/manifest.json',
'https://iiif.bodleian.ox.ac.uk/iiif/manifest/e1004f2e-cc99-4341-8980-9f967da2ba16.json',
'https://www.digitalcollections.manchester.ac.uk/iiif/PR-JAPANESE-00048',
'https://digitalcollections.lancaster.ac.uk/iiif/MS-DAVY-11401',
'https://iiif.harvardartmuseums.org/manifests/object/58651',
'https://data.artmuseum.princeton.edu/iiif/objects/141145',
'https://acdc.amherst.edu//do/beafcb99-0d94-40a6-b861-ac4022efa2d4/metadata/iiifmanifest3cws/default.jsonld',
'https://digitalcollections.iu.edu/concern/images/7d27b5132/manifest',
'https://api.dc.library.northwestern.edu/api/v2/works/f986dbcd-86c6-4785-af31-e0b4c6f480c0?as=iiif',
'https://library.osu.edu/dc/concern/generic_works/g733cq458/manifest',
'https://ids.si.edu/ids/manifest/NMAH-JN2019-01828-000001',
'https://quod.lib.umich.edu/cgi/i/image/api/manifest/bp1ic:CN01',
'https://iiif-manifest.library.nd.edu/manifest/002209657',
'https://digi.vatlib.it/iiif/MSS_Borg.Carte.naut.V/manifest.json',
'https://hdl.huntington.org/iiif/2/p16003coll4:5679/manifest.json',
'https://collections.lib.uwm.edu/iiif/2/agdm:864/manifest.json',
'https://iiif.quartexcollections.com/pepperdine/iiif/b709510c-1e3c-4b1b-abe8-4fc9917e07a9/manifest',
'https://digitalcollections.lib.washington.edu/iiif/2/skinner:907/manifest.json',
'https://cdm15808.contentdm.oclc.org/iiif/2/archives:668/manifest.json',
'https://d.lib.ncsu.edu/collections/catalog/mc00240-001-ff0093-001-001_0010/manifest',
'https://iiif.quartexcollections.com/rice/iiif/bf437e36-33ab-4962-b372-59d6214e087f/manifest',
'https://jdm.library.jhu.edu/iiif-pres-dlmm/pizan/Arsenal3356/manifest',
'https://repository.duke.edu/iiif/ark%3A%2F87924%2Fr4jd50j64/manifest',
'https://digital.library.manoa.hawaii.edu/iiif/23762/manifest',
'https://iiif.quartexcollections.com/portland/iiif/e4b78bc1-fbb0-4539-8bc4-ae4d1ac1c8d3/manifest',
'https://iiif.library.ubc.ca/presentation/cdm.rainbow.1-0357825/manifest',
'https://digital.library.villanova.edu/Item/vudl:98712/Manifest',
'https://curate.library.emory.edu/iiif//310jsxkss8-cor/manifest',
'https://cdm16022.contentdm.oclc.org/iiif/nico:1676/manifest.json',
'https://explore.digitalsd.org/iiif/2/carterjohnson:1561/manifest.json',
'https://iiif.library.leeds.ac.uk/presentation/cc/dpgpb6r9',
'https://contentdm.lib.byu.edu/iiif/2/p15999coll31:40558/manifest.json',

];

// Results storage
const missingLabels = {
  date: new Set(),
  author: new Set(),
  collection: new Set(),
  attribution: new Set(),
  uncategorized: new Set()
};

const manifestsWithGaps = [];

// Fetch manifest from URL
function fetchManifest(url) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      client.get(url, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          fetchManifest(res.headers.location).then(resolve).catch(reject);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON: ${e.message}`));
          }
        });
      }).on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

// Extract all metadata labels from manifest
function extractAllLabels(manifest) {
  const labels = new Set();
  
  // Manifest-level metadata
  if (manifest.metadata) {
    manifest.metadata.forEach(item => {
      const label = normalizeLabel(item.label);
      if (label) labels.add(label);
    });
  }
  
  // Canvas-level metadata (IIIF 2.0)
  if (manifest.sequences) {
    manifest.sequences.forEach(seq => {
      seq.canvases?.forEach(canvas => {
        canvas.metadata?.forEach(item => {
          const label = normalizeLabel(item.label);
          if (label) labels.add(label);
        });
      });
    });
  }
  
  // Canvas-level metadata (IIIF 3.0)
  if (manifest.items) {
    manifest.items.forEach(canvas => {
      canvas.metadata?.forEach(item => {
        const label = normalizeLabel(item.label);
        if (label) labels.add(label);
      });
    });
  }
  
  return Array.from(labels);
}

// Normalize label to string
function normalizeLabel(label) {
  if (typeof label === 'string') {
    return label.trim();
  }
  if (typeof label === 'object') {
    const values = Object.values(label).flat();
    return values[0]?.trim();
  }
  return null;
}

// Categorize label based on keywords
function categorizeLabel(label) {
  const lower = label.toLowerCase();
  
  // Date-related
  if (lower.includes('date') || lower.includes('created') || 
      lower.includes('issued') || lower.includes('published') ||
      lower.includes('made')) {
    return 'date';
  }
  
  // Author-related
  if (lower.includes('creator') || lower.includes('author') || 
      lower.includes('artist') || lower.includes('maker') ||
      lower.includes('contributor') || lower.includes('publisher')) {
    return 'author';
  }
  
  // Collection-related
  if (lower.includes('collection') || lower.includes('location') || 
      lower.includes('repository') || lower.includes('source') ||
      lower.includes('relation')) {
    return 'collection';
  }
  
  // Attribution-related
  if (lower.includes('attribution') || lower.includes('digital publisher') ||
      lower.includes('provider')) {
    return 'attribution';
  }
  
  return null;
}

// Check if label is already in fallbacks
function isInCurrentFallbacks(label, category) {
  if (!category) return false;
  
  const currentLabels = CURRENT_FALLBACKS[category].map(l => l.toLowerCase());
  return currentLabels.includes(label.toLowerCase());
}

// Main analysis
async function analyzeGaps() {
  console.log(`Analyzing ${manifestUrls.length} manifests for missing fallbacks...\n`);
  
  for (let i = 0; i < manifestUrls.length; i++) {
    const url = manifestUrls[i];
    console.log(`[${i + 1}/${manifestUrls.length}] Analyzing: ${url}`);
    
    try {
      const manifest = await fetchManifest(url);
      const labels = extractAllLabels(manifest);
      const institution = getInstitution(manifest, url);
      
      const gaps = [];
      
      // Check each label
      labels.forEach(label => {
        const category = categorizeLabel(label);
        
        if (category) {
          // Is this label already in our fallbacks?
          if (!isInCurrentFallbacks(label, category)) {
            missingLabels[category].add(label);
            gaps.push({ label, category });
          }
        } else {
          // Uncategorized label
          missingLabels.uncategorized.add(label);
        }
      });
      
      if (gaps.length > 0) {
        manifestsWithGaps.push({
          url,
          institution,
          gaps
        });
      }
      
    } catch (error) {
      console.error(`  ERROR: ${error.message}`);
    }
  }
  
  generateGapReport();
}

// Get institution name from manifest
function getInstitution(manifest, url) {
  // Try attribution
  if (manifest.attribution) {
    if (typeof manifest.attribution === 'string') {
      return manifest.attribution.substring(0, 60).replace(/<[^>]*>/g, '');
    }
    if (Array.isArray(manifest.attribution)) {
      return manifest.attribution[0]?.substring(0, 60).replace(/<[^>]*>/g, '');
    }
  }
  
  // Try provider (IIIF 3.0)
  if (manifest.provider) {
    const label = manifest.provider[0]?.label;
    if (label) {
      const text = Object.values(label).flat()[0];
      return text?.substring(0, 60);
    }
  }
  
  // Try label
  if (manifest.label) {
    if (typeof manifest.label === 'string') {
      return manifest.label.substring(0, 60);
    }
    if (typeof manifest.label === 'object') {
      return Object.values(manifest.label).flat()[0]?.substring(0, 60);
    }
  }
  
  // Fallback to domain
  try {
    return new URL(url).hostname;
  } catch {
    return 'Unknown';
  }
}

// Generate gap report
function generateGapReport() {
  console.log('\n' + '='.repeat(80));
  console.log('GAP ANALYSIS REPORT: Missing Fallbacks');
  console.log('='.repeat(80) + '\n');
  
  // Summary
  console.log('SUMMARY:');
  console.log(`  Total manifests analyzed: ${manifestUrls.length}`);
  console.log(`  Manifests with gaps: ${manifestsWithGaps.length}`);
  console.log(`  Coverage: ${((1 - manifestsWithGaps.length / manifestUrls.length) * 100).toFixed(1)}%\n`);
  
  // Missing labels by category
  for (const [category, labels] of Object.entries(missingLabels)) {
    if (labels.size === 0) continue;
    
    console.log(`\n### MISSING ${category.toUpperCase()} LABELS ###\n`);
    console.log(`Found ${labels.size} new labels not in current fallbacks:\n`);
    
    Array.from(labels).sort().forEach(label => {
      // Find which institutions use this label
      const institutions = manifestsWithGaps
        .filter(m => m.gaps.some(g => g.label === label))
        .map(m => m.institution);
      
      console.log(`  "${label}"`);
      console.log(`    Used by: ${institutions.join(', ')}`);
      console.log();
    });
  }
  
  // Detailed manifest-by-manifest report
  if (manifestsWithGaps.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('DETAILED GAP REPORT BY MANIFEST');
    console.log('='.repeat(80) + '\n');
    
    manifestsWithGaps.forEach(manifest => {
      console.log(`Institution: ${manifest.institution}`);
      console.log(`URL: ${manifest.url}`);
      console.log(`Missing labels:`);
      manifest.gaps.forEach(gap => {
        console.log(`  - "${gap.label}" (category: ${gap.category})`);
      });
      console.log();
    });
  }
  
  // Generate updated code
  if (Object.values(missingLabels).some(set => set.size > 0)) {
    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDED CODE UPDATES');
    console.log('='.repeat(80) + '\n');
    
    generateUpdatedCode();
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('✓ NO GAPS FOUND - Your fallbacks cover all manifests!');
    console.log('='.repeat(80) + '\n');
  }
}

// Generate updated fallback code
function generateUpdatedCode() {
  for (const [category, newLabels] of Object.entries(missingLabels)) {
    if (newLabels.size === 0 || category === 'uncategorized') continue;
    
    const current = CURRENT_FALLBACKS[category];
    const updated = [...current, ...Array.from(newLabels)];
    
    console.log(`// Updated ${category.toUpperCase()} fallbacks:`);
    console.log(`let ${category} = `);
    
    updated.forEach((label, index) => {
      const isFirst = index === 0;
      const isLast = index === updated.length - 1;
      const location = isFirst ? 'canvasMetadata' : 'manifestMetadata';
      
      if (Array.from(newLabels).includes(label)) {
        console.log(`  getMetadataValue(${location}, '${label}') || // ← NEW`);
      } else {
        console.log(`  getMetadataValue(${location}, '${label}')${isLast ? ' ||' : ' ||'}`);
      }
    });
    
    console.log(`  'No ${category} returned';\n`);
  }
  
  // Report uncategorized labels separately
  if (missingLabels.uncategorized.size > 0) {
    console.log('// UNCATEGORIZED LABELS (review manually):');
    Array.from(missingLabels.uncategorized).forEach(label => {
      console.log(`// - "${label}"`);
    });
    console.log();
  }
}

// Run analysis
analyzeGaps();
