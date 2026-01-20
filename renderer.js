// State
let currentFolder = null;
let scannedFiles = [];
let analyzedFiles = [];
let apiKey = null;

// DOM Elements
const apiSetup = document.getElementById('api-setup');
const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const dropZone = document.getElementById('drop-zone');
const dropArea = document.getElementById('drop-area');
const scanning = document.getElementById('scanning');
const results = document.getElementById('results');
const folderPath = document.getElementById('folder-path');
const fileList = document.getElementById('file-list');
const selectAllCheckbox = document.getElementById('select-all');
const undoBtn = document.getElementById('undo-btn');
const organizeBtn = document.getElementById('organize-btn');
const success = document.getElementById('success');
const successMessage = document.getElementById('success-message');
const organizeMoreBtn = document.getElementById('organize-more-btn');
const error = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const tryAgainBtn = document.getElementById('try-again-btn');

// Initialize
async function init() {
  const settings = await window.tidyup.getSettings();
  
  if (settings.apiKey) {
    apiKey = settings.apiKey;
    apiSetup.classList.add('hidden');
  } else {
    apiSetup.classList.remove('hidden');
  }
  
  const historyCount = await window.tidyup.getHistoryCount();
  undoBtn.disabled = historyCount === 0;
}

// Show/Hide sections
function showSection(section) {
  [apiSetup, dropZone, scanning, results, success, error].forEach(el => {
    el.classList.add('hidden');
  });
  section.classList.remove('hidden');
}

// API Key Setup
saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key || !key.startsWith('sk-')) {
    alert('Please enter a valid OpenAI API key');
    return;
  }
  
  await window.tidyup.saveApiKey(key);
  apiKey = key;
  apiSetup.classList.add('hidden');
});

// Drop Zone
dropArea.addEventListener('click', async () => {
  const folder = await window.tidyup.selectFolder();
  if (folder) {
    await processFolder(folder);
  }
});

dropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropArea.classList.add('dragover');
});

dropArea.addEventListener('dragleave', () => {
  dropArea.classList.remove('dragover');
});

dropArea.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropArea.classList.remove('dragover');
  
  // Note: Electron drag-and-drop of folders needs special handling
  // For now, we'll use the file dialog
  const folder = await window.tidyup.selectFolder();
  if (folder) {
    await processFolder(folder);
  }
});

// Process folder
async function processFolder(folder) {
  if (!apiKey) {
    showSection(apiSetup);
    return;
  }
  
  currentFolder = folder;
  showSection(scanning);
  
  try {
    // Scan files
    scannedFiles = await window.tidyup.scanFolder(folder);
    
    if (scannedFiles.length === 0) {
      throw new Error('No files found in folder');
    }
    
    // Analyze with AI
    analyzedFiles = await window.tidyup.analyzeFiles(scannedFiles, apiKey);
    
    // Display results
    displayResults();
  } catch (e) {
    errorMessage.textContent = e.message;
    showSection(error);
  }
}

// Display results
function displayResults() {
  folderPath.textContent = currentFolder;
  fileList.innerHTML = '';
  
  // Match analyzed files with scanned files
  analyzedFiles.forEach((analysis, index) => {
    const scanned = scannedFiles.find(f => f.name === analysis.name);
    if (!scanned) return;
    
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <input type="checkbox" checked data-index="${index}" />
      <div class="file-info">
        <div class="file-name">${escapeHtml(analysis.name)}</div>
        <div class="file-dest">→ <span>${escapeHtml(analysis.folder)}</span></div>
      </div>
      <span class="confidence ${analysis.confidence}">${analysis.confidence}</span>
    `;
    fileList.appendChild(item);
  });
  
  showSection(results);
  updateSelectAll();
}

// Select all
selectAllCheckbox.addEventListener('change', () => {
  const checkboxes = fileList.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
});

function updateSelectAll() {
  const checkboxes = fileList.querySelectorAll('input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  selectAllCheckbox.checked = allChecked;
}

fileList.addEventListener('change', (e) => {
  if (e.target.type === 'checkbox') {
    updateSelectAll();
  }
});

// Organize
organizeBtn.addEventListener('click', async () => {
  const checkboxes = fileList.querySelectorAll('input[type="checkbox"]:checked');
  const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
  
  if (selectedIndices.length === 0) {
    alert('Please select at least one file to organize');
    return;
  }
  
  const moves = selectedIndices.map(i => {
    const analysis = analyzedFiles[i];
    const scanned = scannedFiles.find(f => f.name === analysis.name);
    return {
      name: analysis.name,
      folder: analysis.folder,
      sourcePath: scanned.path
    };
  });
  
  organizeBtn.disabled = true;
  organizeBtn.textContent = 'Organizing...';
  
  try {
    const results = await window.tidyup.executeMoves(moves, currentFolder);
    const successCount = results.filter(r => r.success).length;
    
    successMessage.textContent = `Moved ${successCount} files successfully!`;
    showSection(success);
    
    // Update undo button
    const historyCount = await window.tidyup.getHistoryCount();
    undoBtn.disabled = historyCount === 0;
  } catch (e) {
    errorMessage.textContent = e.message;
    showSection(error);
  } finally {
    organizeBtn.disabled = false;
    organizeBtn.textContent = '✨ Organize Files';
  }
});

// Undo
undoBtn.addEventListener('click', async () => {
  undoBtn.disabled = true;
  
  try {
    const result = await window.tidyup.undoLast();
    if (result.success) {
      alert(`Undid ${result.count} file moves`);
    } else {
      alert(result.error);
    }
    
    const historyCount = await window.tidyup.getHistoryCount();
    undoBtn.disabled = historyCount === 0;
  } catch (e) {
    alert('Failed to undo: ' + e.message);
    undoBtn.disabled = false;
  }
});

// Organize more / Try again
organizeMoreBtn.addEventListener('click', () => {
  currentFolder = null;
  scannedFiles = [];
  analyzedFiles = [];
  showSection(dropZone);
});

tryAgainBtn.addEventListener('click', () => {
  showSection(dropZone);
});

// Utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start
init();
