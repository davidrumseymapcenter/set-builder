let viewer;
let collectedManifests = []; // This will hold the individual manifests
let currentManifestForSelection = null; 
let selectedPageIndices = new Set(); 

// Global state for gallery name
let currentGalleryName = '';

// Function to set gallery name across all displays
function setGalleryName(name) {
  const sanitized = name ? name.trim() : '';
  currentGalleryName = sanitized;
  
  // Update input field
  const nameInput = document.getElementById('manifestName');
  if (nameInput) {
    nameInput.value = sanitized;
  }
  
  // Update page display
  updatePageTitle(sanitized);
}

// Function to update page title display
function updatePageTitle(galleryName) {
  const titleDisplay = document.getElementById('gallery-title-display');
  
  if (!titleDisplay) return;
  
  if (galleryName) {
    // Escape HTML for safety
    const tempDiv = document.createElement('div');
    tempDiv.textContent = galleryName;
    const safeGalleryName = tempDiv.innerHTML;
    
    titleDisplay.innerHTML = safeGalleryName;
    
    // Update browser tab title
    document.title = `${galleryName} - IIIF Gallery Builder`;
  } else {
    titleDisplay.innerHTML = '';
    
    // Reset browser tab title
    document.title = 'IIIF Image Gallery Builder';
  }
}

// Function to open the first image in the viewer
function openFirstImage() {
  const firstThumb = document.querySelector('#gallery .card img');
  if (firstThumb) {
    firstThumb.click();
    document.body.classList.add('viewer-has-image');
  }
}

// --- begin deeplink fileopening script --
(function() {
const FILE_INPUT_SELECTOR = '#uploadManifest';
const LOAD_BUTTON_SELECTOR = '#loadManifest';

// Wait for DOM, then defer to the next tick so other DOMContentLoaded handlers
// (like initializeEventListeners) have time to attach their listeners.
document.addEventListener('DOMContentLoaded', () => {
setTimeout(() => {
openHostedFileFromQuery().catch(err => {
console.error('Deep-link file loading failed:', err);
alert('Unable to load file from URL. Make sure it is public and supports CORS.');
});
}, 0);
});

async function openHostedFileFromQuery() {
const params = new URLSearchParams(window.location.search);
const rawParam = params.get('file') || params.get('url');
if (!rawParam) return;

const fileUrl = normalizeFileUrl(rawParam);
const response = await fetch(fileUrl, { mode: 'cors', credentials: 'omit', redirect: 'follow' });
if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${fileUrl}`);

const blob = await response.blob();
const filename = params.get('filename') || deriveFilenameFromUrl(fileUrl);
const fileObj = new File([blob], filename, { type: blob.type || 'application/json' });

const input = document.querySelector(FILE_INPUT_SELECTOR) || document.querySelector('input[type="file"]');
if (!input || input.type !== 'file') {
  throw new Error('File input not found. Set FILE_INPUT_SELECTOR to your input element.');
}

// Insert the file and trigger your existing change handler
const dt = new DataTransfer();
dt.items.add(fileObj);
input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true }));

// Autoload by clicking your existing Load button
const loadBtn = document.querySelector(LOAD_BUTTON_SELECTOR);
if (loadBtn) {
  // Ensure the click runs after all change handlers complete
  setTimeout(() => {
    loadBtn.click();
  }, 0);
} else {
  console.warn('Load button not found. Set LOAD_BUTTON_SELECTOR correctly.');
}

}

function normalizeFileUrl(u) {
try {
const url = new URL(u);
if (url.hostname === 'github.com') {
const parts = url.pathname.split('/');
const blobIdx = parts.indexOf('blob');
if (blobIdx !== -1) {
const newPath = parts.slice(0, blobIdx).concat(parts.slice(blobIdx + 1)).join('/');
return 'https://raw.githubusercontent.com' + newPath;
}
}
return u;
} catch (e) {
return u;
}
}

function deriveFilenameFromUrl(u) {
try {
const url = new URL(u);
const base = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
return decodeURIComponent(base || 'download.json');
} catch {
return 'download.json';
}
}
})();

/* --- end deeplink fileloading -- */

document.addEventListener('DOMContentLoaded', () => {
  viewer = OpenSeadragon({
    id: 'viewer',
    prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.0.0/images/',
    tileSources: []
  });

  // Initialize resizer functionality
  initializeResizer();

  // Initialize all event listeners
  initializeEventListeners();
});

// Function to make the viewer resizable
function initializeResizer() {
  const resizer = document.getElementById('resizer');
  const leftPanel = document.querySelector('.left-panel');
  const viewer = document.getElementById('viewer');
  
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection while dragging
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const containerWidth = document.querySelector('.container').offsetWidth;
    const newLeftWidth = (e.clientX / containerWidth) * 100;

    // Set bounds for resizing (min 20%, max 80%)
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

// Function to make cards draggable and reorderable
function makeCardDraggable(card) {
  card.draggable = true;

  card.addEventListener('dragstart', (e) => {
    // Prevent dragging if clicking on image or links
    if (e.target.tagName === 'IMG' || e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
      return;
    }
    
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', card.innerHTML);
  });

  card.addEventListener('dragend', (e) => {
    card.classList.remove('dragging');
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const draggingCard = document.querySelector('.dragging');
    if (draggingCard && draggingCard !== card) {
      card.classList.add('drag-over');
    }
  });

  card.addEventListener('dragleave', (e) => {
    card.classList.remove('drag-over');
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    
    const draggingCard = document.querySelector('.dragging');
    if (draggingCard && draggingCard !== card) {
      const gallery = document.getElementById('gallery');
      const allCards = [...gallery.querySelectorAll('.card')];
      const draggedIndex = allCards.indexOf(draggingCard);
      const targetIndex = allCards.indexOf(card);

      if (draggedIndex < targetIndex) {
        card.parentNode.insertBefore(draggingCard, card.nextSibling);
      } else {
        card.parentNode.insertBefore(draggingCard, card);
      }
    }
  });
}
// Detect IIIF version
function getIIIFVersion(manifest) {
  if (manifest['@context']) {
    if (manifest['@context'].includes('/3/')) {
      return 3;
    }
    if (manifest['@context'].includes('/2/')) {
      return 2;
    }
  }
  // If no @context, check for sequences (IIIF 2.0) vs items (IIIF 3.0)
  return manifest.sequences ? 2 : 3;
}

// Helper function to get metadata values (handles both IIIF 2.0 and 3.0)
function getMetadataValue(metadata, label, getLast = false) {
  if (!metadata) return null;
  
  // Normalize label to lowercase for comparison
  const normalizedLabel = label.toLowerCase();
  
  const items = metadata.filter(item => {
    
    // IIIF 2.0 format: item.label is a string
    if (typeof item.label === 'string') {
      return item.label.toLowerCase() === normalizedLabel;
    }   
    // IIIF 3.0 format: item.label is an object like {none: ["Title"]} or {en: ["Title"]}
    if (typeof item.label === 'object') {
      const labelValues = Object.values(item.label).flat();
      return labelValues.some(val => val.toLowerCase() === normalizedLabel);
    }
    return false;
  });
  
  if (items.length === 0) return null;
  
  const item = getLast ? items[items.length - 1] : items[0];
  
  // IIIF 2.0 format: value is a string or array
  if (typeof item.value === 'string') {
    return item.value;
  }
  if (Array.isArray(item.value)) {
    if(typeof item.value[0] === 'object') { return Object.values(item.value[0])[1]; }
    else { return item.value[0]; }
  }
  
  // IIIF 3.0 format: value is an object like {none: ["value"]} or {en: ["value"]}
  if (typeof item.value === 'object') {
    const valueArray = Object.values(item.value).flat();
    return valueArray[0] || null;
  }
  
  return null;
}


// Helper function to check if URL is absolute
function isAbsoluteURL(url) {
  return /^(http|https):\/\//i.test(url);
}

// Function to add a canvas to the gallery (supports IIIF 2.0 and 3.0)
function addCanvasToGallery(canvas, manifest) {
  const iiifVersion = getIIIFVersion(manifest);
  
  let imageService, imageUrl, highResUrl;
  
  // Handle different IIIF versions for image extraction
if (iiifVersion === 3) {
  // IIIF 3.0 structure: canvas.items[0].items[0].body.service[0]
  const annotation = canvas.items?.[0]?.items?.[0];
  if (!annotation || !annotation.body) {
    console.error('IIIF 3.0: Missing annotation body:', canvas);
    return;
  }
  
  imageService = annotation.body.service?.[0];
  if (!imageService) {
    console.error('IIIF 3.0: Image service is missing:', canvas);
    return;
  }
  
  // Handle both IIIF 3.0 (id) and IIIF 2.0 (@id) image service formats
  const serviceId = imageService.id || imageService['@id'];
  if (!serviceId) {
    console.error('IIIF 3.0: Image service does not contain an id or @id field:', canvas);
    return;
  }
  
  imageUrl = `${serviceId}/full/!200,200/0/default.jpg`;
  highResUrl = `${serviceId}/info.json`;
  
} else {
  // IIIF 2.0 structure: canvas.images[0].resource.service
  imageService = canvas.images?.[0]?.resource?.service;
  if (!imageService || !imageService['@id']) {
    console.error('IIIF 2.0: Image service is missing or does not contain an @id field:', canvas);
    return;
  }
  
  imageUrl = `${imageService['@id']}/full/!200,200/0/default.jpg`;
  highResUrl = `${imageService['@id']}/info.json`;
}

  // Retrieve metadata from both the manifest and the canvas
  const manifestMetadata = manifest.metadata || [];    
  const canvasMetadata = canvas.metadata || [];

  console.log('Manifest Metadata:', manifestMetadata);
  console.log('Canvas Metadata:', canvasMetadata);

  // Extract title - handle both IIIF 2.0 and 3.0
  let title = 'No title returned';
  
  if (iiifVersion === 3) {
    // IIIF 3.0: labels are objects like {none: ["Title"]} or {en: ["Title"]}
    if (manifest.label) {
      const labelValues = Object.values(manifest.label).flat();
      title = labelValues[0] || 'No title returned';
    }
  } else {
    // IIIF 2.0: labels are strings
    title = manifest.label || 'No title returned';
  }
  
  // Also check metadata for title (works for both versions now)
  const metadataTitle = getMetadataValue(canvasMetadata, 'Title') || getMetadataValue(manifestMetadata, 'Title');
  if (metadataTitle) title = metadataTitle;

 // Get date
let date = getMetadataValue(canvasMetadata, 'Date') || 
           getMetadataValue(manifestMetadata, 'Date') || 
           getMetadataValue(manifestMetadata, 'Issued') ||           // Princeton
           getMetadataValue(canvasMetadata, 'Issued') ||             
           getMetadataValue(manifestMetadata, 'Created') ||          
           getMetadataValue(canvasMetadata, 'Created') ||            
           getMetadataValue(manifestMetadata, 'Date made') ||        // Smithsonian
           getMetadataValue(canvasMetadata, 'Date made') ||          
           getMetadataValue(manifestMetadata, 'Published') ||        // Berkeley (if included)
           getMetadataValue(canvasMetadata, 'Published') ||
           getMetadataValue(manifestMetadata, 'Created Published') || 
           getMetadataValue(canvasMetadata, 'Associated date') || 
           getMetadataValue(manifestMetadata, 'Associated date') ||
           getMetadataValue(manifestMetadata, 'Publication Date') || // CONTENTdm
           getMetadataValue(canvasMetadata, 'Publication Date') ||
           'No date returned';

  // Get author/creator
  let author = getMetadataValue(canvasMetadata, 'Creator') || 
               getMetadataValue(manifestMetadata, 'Creator') || 
               getMetadataValue(canvasMetadata, 'Contributors') || 
               getMetadataValue(manifestMetadata, 'Contributors') || 
               getMetadataValue(canvasMetadata, 'Author') || 
               getMetadataValue(manifestMetadata, 'Author') || 
               getMetadataValue(canvasMetadata, 'Contributor') || 
               getMetadataValue(manifestMetadata, 'Contributor') ||
               getMetadataValue(canvasMetadata, 'Publisher') || 
               getMetadataValue(manifestMetadata, 'Publisher') || 
               getMetadataValue(canvasMetadata, 'Artist/Maker') ||
               getMetadataValue(manifestMetadata, 'Artist/Maker') ||
               'No author returned';

 // Get collection
let collection = getMetadataValue(canvasMetadata, 'Location') || 
                 getMetadataValue(manifestMetadata, 'Location') || 
                 getMetadataValue(manifestMetadata, 'Collection') || 
                 getMetadataValue(canvasMetadata, 'Collection') || 
                 getMetadataValue(manifestMetadata, 'Relation') ||  // Stanford uses this for collection
                 getMetadataValue(canvasMetadata, 'Data Source') || 
                 getMetadataValue(manifestMetadata, 'Data Source') || 
                 'No collection returned';

// For Internet Archive (IIIF 3.0), prefer Contributor over Collection
if (iiifVersion === 3) {
  const contributor = getMetadataValue(manifestMetadata, 'Contributor') || 
                      getMetadataValue(canvasMetadata, 'Contributor');
  if (contributor) {
    collection = contributor;
  }
}
  // Get attribution
  let attribution = 'No attribution returned';
  if (iiifVersion === 3) {
    // IIIF 3.0: check provider or requiredStatement
    if (manifest.provider?.[0]?.label) {
      const providerLabel = Object.values(manifest.provider[0].label).flat();
      attribution = providerLabel[0] || 'No attribution returned';
    }
    if (manifest.requiredStatement?.value) {
      const reqValue = Object.values(manifest.requiredStatement.value).flat();
      attribution = reqValue[0] || attribution;
    }
  } else {
    // IIIF 2.0: Try metadata fields first (more reliable than attribution field)
  attribution = getMetadataValue(manifestMetadata, 'Repository') ||
                getMetadataValue(manifestMetadata, 'Digital Publisher') ||
                getMetadataValue(canvasMetadata, 'Repository');
  
  // If metadata doesn't have it, try attribution field
  if (!attribution) {
    if (manifest.attribution) {
      // Handle array or string
      if (Array.isArray(manifest.attribution)) {
        // Only use if it's not a URL
        const nonUrl = manifest.attribution.find(a => a && a.trim() && !a.startsWith('http'));
        attribution = nonUrl || 'No attribution returned';
      } else if (!manifest.attribution.startsWith('http')) {
        attribution = manifest.attribution;
      }
    }
  }
  
  // Final fallback
  if (!attribution) {
    attribution = 'No attribution returned';
  }
}


  // Get location link from various possible sources
  let locationLink = null;

  if (iiifVersion === 3) {
    // IIIF 3.0: check homepage
    if (manifest.homepage?.[0]?.id) {
      locationLink = manifest.homepage[0].id;
    }
  } else {
    // IIIF 2.0: check related field (David Rumsey / LUNA)
    if (manifest.related) {
      if (typeof manifest.related === 'object' && manifest.related["@id"]) {
        locationLink = manifest.related["@id"];
      } else if (typeof manifest.related === 'string') {
        locationLink = manifest.related;
      }
    }
  }

  // If locationLink is still not defined, check other sources
if (!locationLink) {
  // Try to extract URL from Source metadata (CONTENTdm often has HTML here)
  const sourceMetadata = getMetadataValue(manifestMetadata, 'Source');
  if (sourceMetadata && sourceMetadata.includes('href=')) {
    // Extract URL from HTML
    const match = sourceMetadata.match(/href=["']([^"']+)["']/);
    if (match && match[1]) {
      locationLink = match[1];
    }
  }
}

  // If still not found, try other fields

  if (!locationLink) {
    locationLink = getMetadataValue(canvasMetadata, 'Identifier') || 
                   getMetadataValue(manifestMetadata, 'Identifier', true) ||
                   getMetadataValue(canvasMetadata, 'Item Url') ||
                   getMetadataValue(manifestMetadata, 'Item Url') ||
                   getMetadataValue(manifestMetadata, 'identifier-access') || // Internet Archive
                   canvas['@id'] ||
                   canvas.id || // IIIF 3.0 uses 'id' instead of '@id'
                   'No link available';
  }

  // Ensure the link is absolute
  if (!isAbsoluteURL(locationLink) && locationLink !== 'No link available') {
    locationLink = 'https://' + locationLink;
  }

   // --- Construct the Allmaps Link ---
  //Get the manifest URL
  const manifestUrlForGeoreferencing = manifest.id || manifest['@id'];

  //Create the full Allmaps Editor URL
  const allmapsLink = `https://editor.allmaps.org/?url=${encodeURIComponent(manifestUrlForGeoreferencing)}`;

  // Debugging logs for verification
  console.log('Location Link:', locationLink);

  // Create card element
  const card = document.createElement('div');
  card.className = 'card';
  
    // Store canvas and manifest data on the card
  card.dataset.manifestId = manifest['@id'] || manifest.id;
  card.dataset.canvasData = JSON.stringify(canvas);

  // Make card draggable
  makeCardDraggable(card);

  // Create image element
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = title;

  // Click to view in OpenSeadragon
  img.addEventListener('click', () => {
    viewer.open(highResUrl);
  });

  // Create delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '×';
  deleteBtn.addEventListener('click', () => {
    const shouldRemove = confirm('Do you want to remove this image from the gallery?');
    if (shouldRemove) {
      card.remove();
    }
  });

  // Create metadata elements
  const titleEl = document.createElement('p');
  titleEl.innerHTML = `<strong>Title:</strong> ${title}`;

  const authorEl = document.createElement('p');
  authorEl.innerHTML = `<strong>Author:</strong> ${author}`;

  const dateEl = document.createElement('p');
  dateEl.innerHTML = `<strong>Date:</strong> ${date}`;

  const collectionEl = document.createElement('p');
  collectionEl.innerHTML = `<strong>Collection:</strong> ${collection}`;

  const attributionEl = document.createElement('p');
  attributionEl.innerHTML = `<strong>Attribution:</strong> ${attribution}`;

  // Create link to item
  const locationLinkEl = document.createElement('a');
  locationLinkEl.href = locationLink;
  locationLinkEl.textContent = 'View Item';
  locationLinkEl.target = '_blank';

  const locationParagraph = document.createElement('p');
  locationParagraph.appendChild(locationLinkEl);

  // Create link to IIIF manifest
  const manifestLinkEl = document.createElement('a');
  manifestLinkEl.href = manifest['@id'] || manifest.id || '#';
  manifestLinkEl.textContent = 'View IIIF Manifest';
  manifestLinkEl.target = '_blank';

  const manifestParagraph = document.createElement('p');
  manifestParagraph.appendChild(manifestLinkEl);

  // Create link to Allmaps
  const allmapsLinkEl = document.createElement('a');
  allmapsLinkEl.href = allmapsLink;
  allmapsLinkEl.textContent = 'Open in Allmaps Editor';
  allmapsLinkEl.target = '_blank';

  const allmapsParagraph = document.createElement('p');
  allmapsParagraph.appendChild(allmapsLinkEl);

  // Append all elements to card
  card.appendChild(deleteBtn);
  card.appendChild(img);
  card.appendChild(titleEl);
  card.appendChild(authorEl);
  card.appendChild(dateEl);
  card.appendChild(collectionEl);
  card.appendChild(attributionEl);
  card.appendChild(locationParagraph);
  card.appendChild(manifestParagraph);
  card.appendChild(allmapsParagraph);

  // Add card to gallery
  document.getElementById('gallery').appendChild(card);
}



// Clear current gallery and add images from loaded collection
function repopulateGallery(manifestData) {
  const gallery = document.getElementById('gallery');
  
  if (!gallery) {
    console.error('Gallery element not found!');
    return;
  }
  
  gallery.innerHTML = '';

  const manifests = manifestData.items;

  if (!Array.isArray(manifests)) {
    console.error('No valid items found in the manifest data.');
    return;
  }

  collectedManifests = [];

  manifests.forEach(manifest => {
    collectedManifests.push(manifest);
    
    const iiifVersion = getIIIFVersion(manifest);
    let canvasItems = [];

    if (iiifVersion === 3) {
      // IIIF 3.0
      canvasItems = manifest.items || [];
    } else {
      // IIIF 2.0
      canvasItems = manifest.sequences?.[0]?.canvases || [];
    }

    canvasItems.forEach(canvas => {
      addCanvasToGallery(canvas, manifest);
    });
  });

  // Set gallery name from loaded manifest
  const galleryName = manifestData.label || '';
  setGalleryName(galleryName);


 //Auto-open first image
  setTimeout(() => {
    openFirstImage();
  }, 100); // Small delay to ensure DOM is ready

}

/// Function to add a IIIF manifest to the gallery (supports both 2.0 and 3.0)
async function addManifestToGallery(manifestUrl) {
  try {
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }

    const manifest = await response.json();
    const iiifVersion = getIIIFVersion(manifest);

    let canvasItems = [];

    if (iiifVersion === 3) {
      if (!manifest.items || manifest.items.length === 0) {
        throw new Error('IIIF 3.0 Manifest does not contain items (canvases).');
      }
      canvasItems = manifest.items;
    } else {
      if (!manifest.sequences || !manifest.sequences[0].canvases) {
        throw new Error('IIIF 2.0 Manifest does not contain sequences or canvases in the expected format.');
      }
      canvasItems = manifest.sequences[0].canvases;
    }

    // Check if multi-page manifest
    if (canvasItems.length > 1) {
      // Show page selector
      showPageSelector(manifest, canvasItems);
    } else {
      // Single page - add directly
      collectedManifests.push(manifest);
      canvasItems.forEach(canvas => {
        addCanvasToGallery(canvas, manifest);
      });
    }

  } catch (error) {
    console.error('Error fetching IIIF Manifest:', error);
    alert(`There was an error fetching the IIIF Manifest: ${error.message}`);
  }
}

// Function to export combined manifest
function exportCombinedManifest() {
  const manifestName = document.getElementById('manifestName').value.trim();
  
  // Auto-generate name if empty
  let finalName = manifestName;
  if (!finalName) {
    const today = new Date().toISOString().split('T')[0];
    finalName = `iiif-gallery-${today}`;
  }
  
  // Update gallery name
  setGalleryName(finalName);

  // Get current gallery state from the DOM
  const gallery = document.getElementById('gallery');
  const cards = gallery.querySelectorAll('.card');
  
  if (cards.length === 0) {
    alert('No images in gallery to export. Please add some manifests first.');
    return;
  }

  // Group cards by manifest
  const manifestGroups = new Map();
  
  cards.forEach(card => {
    const manifestId = card.dataset.manifestId;
    const canvasData = JSON.parse(card.dataset.canvasData);
    
    if (!manifestId || !canvasData) return;
    
    if (!manifestGroups.has(manifestId)) {
      // Find the source manifest
      const sourceManifest = collectedManifests.find(m => 
        (m['@id'] === manifestId || m.id === manifestId)
      );
      
      if (!sourceManifest) return;
      
      manifestGroups.set(manifestId, {
        manifest: sourceManifest,
        canvases: []
      });
    }
    
    manifestGroups.get(manifestId).canvases.push(canvasData);
  });
  
  // Rebuild manifests with current canvases
  const rebuiltManifests = [];
  
  manifestGroups.forEach(({ manifest, canvases }) => {
    const iiifVersion = getIIIFVersion(manifest);
    
    let rebuiltManifest;
    
    if (iiifVersion === 3) {
      rebuiltManifest = {
        ...manifest,
        items: canvases
      };
    } else {
      rebuiltManifest = {
        ...manifest,
        sequences: [{
          ...(manifest.sequences?.[0] || {}),
          canvases: canvases
        }]
      };
    }
    
    rebuiltManifests.push(rebuiltManifest);
  });

  // Update collectedManifests
  collectedManifests = rebuiltManifests;

  // Create combined manifest structure
  const combinedManifest = {
    '@context': 'http://iiif.io/api/presentation/2/context.json',
    '@type': 'sc:Collection',
    '@id': `https://example.org/collection/${finalName}`,
    'label': finalName,
    'items': collectedManifests
  };

  // Convert to JSON string
  const manifestJson = JSON.stringify(combinedManifest, null, 2);

  // Create blob and download
  const blob = new Blob([manifestJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${finalName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert(`Manifest "${finalName}" has been exported successfully!`);
}


// Function to show the page selector modal
function showPageSelector(manifest, canvasItems) {
  currentManifestForSelection = manifest;
  selectedPageIndices.clear();
  
  const modal = document.getElementById('pageSelectorModal');
  const pageGrid = document.getElementById('pageGrid');
  const iiifVersion = getIIIFVersion(manifest);
  
  // Set modal title
  let manifestLabel = 'Untitled Manifest';
  if (iiifVersion === 3 && manifest.label) {
    manifestLabel = Object.values(manifest.label).flat()[0] || 'Untitled Manifest';
  } else if (iiifVersion === 2) {
    manifestLabel = manifest.label || 'Untitled Manifest';
  }
  document.getElementById('modalTitle').textContent = `Select Pages from: ${manifestLabel}`;
  
  // Clear previous pages
  pageGrid.innerHTML = '';
  
  // Add pages to grid
  canvasItems.forEach((canvas, index) => {
    const pageItem = document.createElement('div');
    pageItem.className = 'page-item';
    pageItem.dataset.index = index;
    
    // Get thumbnail URL
    let thumbnailUrl = '';
    if (iiifVersion === 3) {
      const annotation = canvas.items?.[0]?.items?.[0];
      const imageService = annotation?.body?.service?.[0];
    const serviceId = imageService?.id || imageService?.['@id'];
  if (serviceId) {
    thumbnailUrl = `${serviceId}/full/!150,150/0/default.jpg`;
  }
}
    else {
      const imageService = canvas.images?.[0]?.resource?.service;
      if (imageService?.['@id']) {
        thumbnailUrl = `${imageService['@id']}/full/!150,150/0/default.jpg`;
      }
    }
    
    // Get page label
    let pageLabel = `Page ${index + 1}`;
    if (iiifVersion === 3 && canvas.label) {
      const canvasLabel = Object.values(canvas.label).flat()[0];
      if (canvasLabel) pageLabel = canvasLabel;
    } else if (iiifVersion === 2 && canvas.label) {
      pageLabel = canvas.label;
    }
    
    // Create page item HTML
    pageItem.innerHTML = `
      <img src="${thumbnailUrl}" alt="${pageLabel}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22150%22%3E%3Crect fill=%22%23ddd%22 width=%22150%22 height=%22150%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3ENo Image%3C/text%3E%3C/svg%3E'">
      <div class="page-label">${pageLabel}</div>
      <div class="page-number">Index: ${index}</div>
    `;
    
    // Add click handler
    pageItem.addEventListener('click', () => {
      togglePageSelection(index);
    });
    
    pageGrid.appendChild(pageItem);
  });
  
  updateSelectionCount();
  modal.style.display = 'block';
}

// Function to toggle page selection
function togglePageSelection(index) {
  if (selectedPageIndices.has(index)) {
    selectedPageIndices.delete(index);
  } else {
    selectedPageIndices.add(index);
  }
  
  // Update visual state
  const pageItem = document.querySelector(`.page-item[data-index="${index}"]`);
  if (pageItem) {
    pageItem.classList.toggle('selected');
  }
  
  updateSelectionCount();
}

// Function to update selection count
function updateSelectionCount() {
  const count = selectedPageIndices.size;
  const countEl = document.getElementById('selectionCount');
  countEl.textContent = `${count} page${count !== 1 ? 's' : ''} selected`;
  
  // Enable/disable Add button
  const addButton = document.getElementById('addSelectedPages');
  addButton.disabled = count === 0;
}

// Function to select all pages
function selectAllPages() {
  const pageItems = document.querySelectorAll('.page-item');
  pageItems.forEach((item, index) => {
    selectedPageIndices.add(index);
    item.classList.add('selected');
  });
  updateSelectionCount();
}

// Function to deselect all pages
function deselectAllPages() {
  selectedPageIndices.clear();
  const pageItems = document.querySelectorAll('.page-item');
  pageItems.forEach(item => {
    item.classList.remove('selected');
  });
  updateSelectionCount();
}

// Function to close the modal
function closePageSelector() {
  const modal = document.getElementById('pageSelectorModal');
  modal.style.display = 'none';
  currentManifestForSelection = null;
  selectedPageIndices.clear();
}

// Function to add selected pages to gallery
function addSelectedPagesToGallery() {
  if (!currentManifestForSelection || selectedPageIndices.size === 0) {
    return;
  }
  
  const iiifVersion = getIIIFVersion(currentManifestForSelection);
  let allCanvasItems = [];
  
  if (iiifVersion === 3) {
    allCanvasItems = currentManifestForSelection.items || [];
  } else {
    allCanvasItems = currentManifestForSelection.sequences?.[0]?.canvases || [];
  }

// Empty the Add Manifest field after selecting thumbnails
document.getElementById('manifestUrl').value = "";
 
// Create a modified manifest with only selected pages and store it
const sortedIndices = Array.from(selectedPageIndices).sort((a, b) => a - b);
const selectedCanvases = sortedIndices.map(index => allCanvasItems[index]).filter(c => c);

let modifiedManifest;
if (iiifVersion === 3) {
  modifiedManifest = {
    ...currentManifestForSelection,
    items: selectedCanvases
  };
} else { // IIIF 2.0
  modifiedManifest = {
    ...currentManifestForSelection,
    sequences: [{
      ...currentManifestForSelection.sequences[0],
      canvases: selectedCanvases
    }]
  };
}

// Now, push the MODIFIED manifest
collectedManifests.push(modifiedManifest);

// And add the pages to the gallery using the modified manifest context
selectedCanvases.forEach(canvas => {
  if (canvas) {
    addCanvasToGallery(canvas, modifiedManifest); // Use modifiedManifest here
  }
});
  
  closePageSelector();
}


// Initialize all event listeners
function initializeEventListeners() {

  // Auto-load file when chosen (no need for separate Load button)
document.getElementById('uploadManifest').addEventListener('change', async function(e) {
  const file = e.target.files[0];
  
  if (!file) {
    document.getElementById('fileName').textContent = 'No file chosen';
    return;
  }

  // Show loading state
  document.getElementById('fileName').textContent = `Loading ${file.name}...`;
  document.getElementById('fileName').style.color = '#0073A3';

  const reader = new FileReader();
  
  reader.onload = async function(event) {
    const jsonContent = event.target.result;
    try {
      const manifestData = JSON.parse(jsonContent);
      repopulateGallery(manifestData);
      
      // Show success
      document.getElementById('fileName').textContent = `✓ Loaded: ${file.name}`;
      document.getElementById('fileName').style.color = '#28a745';
      
      // Reset after 3 seconds
      setTimeout(() => {
        document.getElementById('fileName').textContent = 'No file chosen';
        document.getElementById('fileName').style.color = '#888';
      }, 3000);
      
    } catch (error) {
      console.error('Error parsing JSON:', error);
      alert(`Failed to load "${file.name}":\n\n${error.message}`);
      document.getElementById('fileName').textContent = 'No file chosen';
      document.getElementById('fileName').style.color = '#888';
    }
  };

  reader.onerror = function() {
    alert('Failed to read file. Please try again.');
    document.getElementById('fileName').textContent = 'No file chosen';
    document.getElementById('fileName').style.color = '#888';
  };

  reader.readAsText(file);
});

// Event listener to load from URL
  document.getElementById('loadFromUrl').addEventListener('click', async () => {
    const urlInput = document.getElementById('galleryUrl');
    const galleryUrl = urlInput.value.trim();

    if (!galleryUrl) {
      alert('Please enter a gallery JSON URL.');
      return;
    }

    try {
      const response = await fetch(galleryUrl, { 
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const manifestData = await response.json();
      repopulateGallery(manifestData);
      
      // Clear the input after successful load
      urlInput.value = '';
      
    } catch (error) {
      console.error('Error loading from URL:', error);
      alert(`Failed to load gallery from URL:\n\n${error.message}\n\nMake sure:\n- The URL is correct\n- The file is publicly accessible\n- CORS is enabled on the server`);
    }
  });

  // Event listener to add manifest URLs to the gallery
  document.getElementById('addManifest').addEventListener('click', async () => {
    const manifestUrls = document.getElementById('manifestUrl').value.split(',').map(url => url.trim());
    if (!manifestUrls.length) {
      alert('Please enter one or more IIIF Manifest URLs');
      return;
    }

    for (const manifestUrl of manifestUrls) {
      if (manifestUrl) {
        await addManifestToGallery(manifestUrl);
      }
    }
  });

 

  // Event listener for the export button
document.getElementById('saveLocally').addEventListener('click', exportCombinedManifest);

  // Event listener for toggle input panel button
document.getElementById('toggleInputs').addEventListener('click', function() {
    const inputPanel = document.getElementById('inputPanel');
    const toggleBtn = document.getElementById('toggleInputs');
    
    if (inputPanel.classList.contains('hidden')) {
      inputPanel.classList.remove('hidden');
      toggleBtn.textContent = 'Hide Input Panel';
    } else {
      inputPanel.classList.add('hidden');
      toggleBtn.textContent = 'Show Input Panel';
    }
});
  
  // Event listener for hide viewer
document.getElementById('toggleViewer').addEventListener('click', function() {
    const toggleViewerBtn = document.getElementById('toggleViewer');
    const container = document.getElementsByClassName("container");
    if (container[0].classList.contains('viewerHidden')) {
      container[0].classList.remove('viewerHidden');
      toggleViewerBtn.textContent = 'Hide Viewer';
    } else {
      container[0].classList.add('viewerHidden');
      toggleViewerBtn.textContent = 'Show Viewer';
    }
});

 
  
 // Page selector modal event listeners
  document.getElementById('selectAllPages').addEventListener('click', selectAllPages);
  document.getElementById('deselectAllPages').addEventListener('click', deselectAllPages);
  document.getElementById('cancelPageSelection').addEventListener('click', closePageSelector);
  document.getElementById('addSelectedPages').addEventListener('click', addSelectedPagesToGallery);
  document.querySelector('.close-modal').addEventListener('click', closePageSelector);
  
// Close modal when clicking outside
window.addEventListener('click', (e) => {
  const modal = document.getElementById('pageSelectorModal');
  if (e.target === modal) {
    closePageSelector();
  }
});}

