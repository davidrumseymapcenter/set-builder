// =================================================================
// 1. GLOBAL VARIABLES
// =================================================================
let viewer;
let collectedManifests = [];
let currentManifestForSelection = null; 
let selectedPageIndices = new Set(); 

// =================================================================
// 2. SCRIPT INITIALIZATION (RUNS ONCE PAGE IS LOADED)
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
  viewer = OpenSeadragon({
    id: 'viewer',
    prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.0.0/images/',
    tileSources: []
  });

  // Call the functions to set up the page's interactivity
  initializeResizer();
  initializeEventListeners();
});

// =================================================================
// 3. ALL FUNCTION DEFINITIONS (GLOBAL SCOPE)
// =================================================================

// --- UI AND INTERACTIVITY FUNCTIONS ---

function initializeResizer() {
  const resizer = document.getElementById('resizer');
  const leftPanel = document.querySelector('.left-panel');
  let isResizing = false;

  resizer.addEventListener('mousedown', () => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const containerWidth = document.querySelector('.container').offsetWidth;
    const newLeftWidth = (e.clientX / containerWidth) * 100;
    if (newLeftWidth > 20 && newLeftWidth < 80) {
      leftPanel.style.width = `${newLeftWidth}%`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
  });
}

function makeCardDraggable(card) {
  card.draggable = true;
  card.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
      e.preventDefault();
      return;
    }
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
}

// --- IIIF HELPER FUNCTIONS ---

function getIIIFVersion(manifest) {
  const context = manifest['@context'];
  if (context) {
    if (Array.isArray(context) && context.includes('http://iiif.io/api/presentation/3/context.json')) return 3;
    if (typeof context === 'string') {
        if (context.includes('/3/')) return 3;
        if (context.includes('/2/')) return 2;
    }
  }
  return manifest.items ? 3 : 2; // Fallback check
}

function getMetadataValue(metadata, label, getLast = false) {
  if (!metadata) return null;
  const normalizedLabel = label.toLowerCase();
  
  const items = metadata.filter(item => {
    if (typeof item.label === 'string') return item.label.toLowerCase() === normalizedLabel;
    if (typeof item.label === 'object') return Object.values(item.label).flat().some(val => val.toLowerCase() === normalizedLabel);
    return false;
  });
  
  if (items.length === 0) return null;
  const item = getLast ? items[items.length - 1] : items[0];
  
  if (typeof item.value === 'string' || Array.isArray(item.value)) return Array.isArray(item.value) ? item.value[0] : item.value;
  if (typeof item.value === 'object') return Object.values(item.value).flat()[0] || null;
  return null;
}

function isAbsoluteURL(url) {
  return /^(https?:)?\/\//i.test(url);
}


// --- GALLERY AND MANIFEST FUNCTIONS ---
// REPLACE the old addCanvasToGallery function with this one.

function addCanvasToGallery(canvas, manifest) {
  const iiifVersion = getIIIFVersion(manifest);
  let imageService, imageUrl, highResUrl;
  
  if (iiifVersion === 3) {
    const annotation = canvas.items?.[0]?.items?.[0];
    imageService = annotation?.body?.service?.[0];
    if (!imageService?.id) { console.error('IIIF 3.0: Image service ID not found.', canvas); return; }
    imageUrl = `${imageService.id}/full/!200,200/0/default.jpg`;
    highResUrl = `${imageService.id}/info.json`;
  } else {
    imageService = canvas.images?.[0]?.resource?.service;
    if (!imageService?.['@id']) { console.error('IIIF 2.0: Image service @id not found.', canvas); return; }
    imageUrl = `${imageService['@id']}/full/!200,200/0/default.jpg`;
    highResUrl = `${imageService['@id']}/info.json`;
  }

  const manifestMetadata = manifest.metadata || [];    
  const canvasMetadata = canvas.metadata || [];

  // --- METADATA RETRIEVAL ---
  const title = (iiifVersion === 3 ? Object.values(manifest.label || {}).flat()[0] : manifest.label) || getMetadataValue(canvasMetadata, 'Title') || getMetadataValue(manifestMetadata, 'Title') || 'No title returned';
  const date = getMetadataValue(canvasMetadata, 'Date') || getMetadataValue(manifestMetadata, 'Date') || getMetadataValue(manifestMetadata, 'Created Published') || 'No date returned';
  const author = getMetadataValue(canvasMetadata, 'Creator') || getMetadataValue(manifestMetadata, 'Creator') || getMetadataValue(canvasMetadata, 'Contributors') || getMetadataValue(manifestMetadata, 'Contributors') || getMetadataValue(canvasMetadata, 'Contributor') || getMetadataValue(manifestMetadata, 'Contributor') || getMetadataValue(canvasMetadata, 'Author') || getMetadataValue(manifestMetadata, 'Author') || 'No author returned';
  const collection = getMetadataValue(manifestMetadata, 'Collection') || getMetadataValue(manifestMetadata, 'Location') || (iiifVersion === 3 && getMetadataValue(manifestMetadata, 'Contributor')) || 'No collection returned';
  const attribution = (iiifVersion === 3 ? (manifest.requiredStatement && Object.values(manifest.requiredStatement.value).flat()[0]) || (manifest.provider?.[0]?.label && Object.values(manifest.provider[0].label).flat()[0]) : manifest.attribution) || 'No attribution returned';
  
  let locationLink = (iiifVersion === 3 ? manifest.homepage?.[0]?.id : manifest.related?.['@id'] || manifest.related) || getMetadataValue(manifestMetadata, 'Identifier', true) || getMetadataValue(manifestMetadata, 'Item Url') || getMetadataValue(manifestMetadata, 'identifier-access') || canvas.id || canvas['@id'] || 'No link available';

  if (locationLink !== 'No link available' && !isAbsoluteURL(locationLink)) {
    locationLink = 'https://' + locationLink.replace(/^\/\//, '');
  }

  // --- NEW: Construct the Allmaps Link ---
  // 1. Get the manifest URL. This could be a modified manifest with only selected pages, which is perfect.
  const manifestUrlForGeoreferencing = manifest.id || manifest['@id'];

  // 2. Create the full Allmaps Editor URL. We MUST encode the manifest URL.
  const allmapsLink = `https://editor.allmaps.org/?url=${encodeURIComponent(manifestUrlForGeoreferencing)}`;


  // --- CARD CREATION ---
  const card = document.createElement('div');
  card.className = 'card';
  makeCardDraggable(card);

  // Add the new "Georeference in Allmaps" link to the card's HTML
  card.innerHTML = `
    <button class="delete-btn" title="Remove from gallery">×</button>
    <img src="${imageUrl}" alt="${title}" data-high-res="${highResUrl}">
    <p><strong>Title:</strong> ${title}</p>
    <p><strong>Author:</strong> ${author}</p>
    <p><strong>Date:</strong> ${date}</p>
    <p><strong>Collection:</strong> ${collection}</p>
    <p><strong>Attribution:</strong> ${attribution}</p>
    <p><a href="${locationLink}" target="_blank" rel="noopener noreferrer">View Item</a></p>
    <p><a href="${allmapsLink}" target="_blank" rel="noopener">Georeference in Allmaps</a></p>
    <p><a href="${manifestUrlForGeoreferencing}" target="_blank" rel="noopener noreferrer" class="manifest-link">View IIIF Manifest</a></p>
  `;

  card.querySelector('.delete-btn').addEventListener('click', () => card.remove());
  card.querySelector('img').addEventListener('click', (e) => {
    viewer.open(e.target.dataset.highRes);
  });

  document.getElementById('gallery').appendChild(card);
}

async function addManifestToGallery(manifestUrl) {
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const manifest = await response.json();
    const iiifVersion = getIIIFVersion(manifest);
    const canvasItems = iiifVersion === 3 ? manifest.items : manifest.sequences?.[0]?.canvases;

    if (!canvasItems || canvasItems.length === 0) {
      alert('Manifest does not contain any images (canvases).');
      return;
    }

    if (canvasItems.length > 1) {
      showPageSelector(manifest, canvasItems);
    } else {
      collectedManifests.push(manifest);
      canvasItems.forEach(canvas => addCanvasToGallery(canvas, manifest));
    }
  } catch (error) {
    console.error('Error fetching or processing IIIF Manifest:', error);
    alert(`Error loading manifest from ${manifestUrl}: ${error.message}`);
  }
}

function repopulateGallery(manifestData) {
  document.getElementById('gallery').innerHTML = '';
  collectedManifests = [];
  const manifests = manifestData.items || [manifestData]; // Handle both collections and single manifests

  manifests.forEach(manifest => {
    collectedManifests.push(manifest);
    const iiifVersion = getIIIFVersion(manifest);
    const canvasItems = iiifVersion === 3 ? manifest.items : manifest.sequences?.[0]?.canvases;
    canvasItems.forEach(canvas => addCanvasToGallery(canvas, manifest));
  });
}

// --- PAGE SELECTOR (PICKER) FUNCTIONS ---

function showPageSelector(manifest, canvasItems) {
  currentManifestForSelection = manifest;
  selectedPageIndices.clear();
  
  const modal = document.getElementById('pageSelectorModal');
  const pageGrid = document.getElementById('pageGrid');
  const iiifVersion = getIIIFVersion(manifest);
  
  const manifestLabel = (iiifVersion === 3 ? Object.values(manifest.label || {}).flat()[0] : manifest.label) || 'Untitled Manifest';
  document.getElementById('modalTitle').textContent = `Select Pages from: ${manifestLabel}`;
  pageGrid.innerHTML = '';
  
  canvasItems.forEach((canvas, index) => {
    const pageItem = document.createElement('div');
    pageItem.className = 'page-item';
    pageItem.dataset.index = index;
    
    let thumbnailUrl = '';
    const imageService = (iiifVersion === 3) ? canvas.items?.[0]?.items?.[0]?.body?.service?.[0] : canvas.images?.[0]?.resource?.service;
    if (imageService) {
        thumbnailUrl = `${imageService.id || imageService['@id']}/full/!150,150/0/default.jpg`;
    }

    const pageLabel = (iiifVersion === 3 ? Object.values(canvas.label || {}).flat()[0] : canvas.label) || `Page ${index + 1}`;
    
    pageItem.innerHTML = `
      <img src="${thumbnailUrl}" alt="${pageLabel}" onerror="this.src='image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; this.alt='Image not available';">
      <div class="page-label">${pageLabel}</div>
    `;
    pageItem.addEventListener('click', () => togglePageSelection(index));
    pageGrid.appendChild(pageItem);
  });
  
  updateSelectionCount();
  modal.style.display = 'block';
}

function togglePageSelection(index) {
  const pageItem = document.querySelector(`.page-item[data-index="${index}"]`);
  if (!pageItem) return;

  pageItem.classList.toggle('selected');
  if (selectedPageIndices.has(index)) {
    selectedPageIndices.delete(index);
  } else {
    selectedPageIndices.add(index);
  }
  updateSelectionCount();
}

function updateSelectionCount() {
  const count = selectedPageIndices.size;
  document.getElementById('selectionCount').textContent = `${count} page${count !== 1 ? 's' : ''} selected`;
  document.getElementById('addSelectedPages').disabled = count === 0;
}

function selectAllPages() {
  document.querySelectorAll('.page-item:not(.selected)').forEach(item => {
    togglePageSelection(parseInt(item.dataset.index));
  });
}

function deselectAllPages() {
  document.querySelectorAll('.page-item.selected').forEach(item => {
    togglePageSelection(parseInt(item.dataset.index));
  });
}

function closePageSelector() {
  document.getElementById('pageSelectorModal').style.display = 'none';
  currentManifestForSelection = null;
  selectedPageIndices.clear();
}

function addSelectedPagesToGallery() {
  if (!currentManifestForSelection || selectedPageIndices.size === 0) return;
  
  const iiifVersion = getIIIFVersion(currentManifestForSelection);
  const allCanvases = iiifVersion === 3 ? currentManifestForSelection.items : currentManifestForSelection.sequences[0].canvases;
  
  const selectedCanvases = Array.from(selectedPageIndices).sort((a,b) => a-b).map(index => allCanvases[index]);
  const modifiedManifest = JSON.parse(JSON.stringify(currentManifestForSelection));

  if (iiifVersion === 3) {
    modifiedManifest.items = selectedCanvases;
  } else {
    modifiedManifest.sequences[0].canvases = selectedCanvases;
  }

  collectedManifests.push(modifiedManifest);
  selectedCanvases.forEach(canvas => addCanvasToGallery(canvas, modifiedManifest));
  
  closePageSelector();
}

// --- EVENT LISTENERS SETUP ---

function initializeEventListeners() {
  // Main input panel listeners
  document.getElementById('addManifest').addEventListener('click', () => {
    const manifestUrls = document.getElementById('manifestUrl').value.split(',').map(url => url.trim());
    manifestUrls.forEach(url => { if (url) addManifestToGallery(url) });
  });

  document.getElementById('uploadManifest').addEventListener('change', (e) => {
    const fileName = e.target.files[0] ? e.target.files[0].name : 'No file chosen';
    document.getElementById('fileName').textContent = fileName;
  });

  document.getElementById('loadManifest').addEventListener('click', () => {
    const file = document.getElementById('uploadManifest').files[0];
    if (!file) { alert('Please select a JSON file to upload.'); return; }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const manifestData = JSON.parse(event.target.result);
        repopulateGallery(manifestData);
      } catch (e) {
        alert('Failed to parse JSON file: ' + e.message);
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('export-manifest').addEventListener('click', () => {
    const manifestName = document.getElementById('manifestName').value.trim() || 'My-IIIF-Collection';
    const blob = new Blob([JSON.stringify({
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      'type': 'Collection',
      'label': { 'en': [ manifestName ] },
      'items': collectedManifests
    }, null, 2)], { type: 'application/json' });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${manifestName}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('toggleInputs').addEventListener('click', function() {
    document.getElementById('inputPanel').classList.toggle('hidden');
    this.textContent = this.textContent.includes('Show') ? 'Hide Input Panel' : 'Show Input Panel';
  });

  // Page selector (picker) modal listeners
  document.getElementById('selectAllPages').addEventListener('click', selectAllPages);
  document.getElementById('deselectAllPages').addEventListener('click', deselectAllPages);
  document.getElementById('cancelPageSelection').addEventListener('click', closePageSelector);
  document.getElementById('addSelectedPages').addEventListener('click', addSelectedPagesToGallery);
  document.querySelector('.close-modal').addEventListener('click', closePageSelector);
  
  window.addEventListener('click', (e) => {
    if (e.target == document.getElementById('pageSelectorModal')) closePageSelector();
  });
}
