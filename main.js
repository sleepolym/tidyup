const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

let mainWindow;
let openai = null;
let moveHistory = [];

// Store settings in app data directory
const getSettingsPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'settings.json');
};

const loadSettings = () => {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return {};
};

const saveSettings = (settings) => {
  try {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e'
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('get-settings', () => {
  return loadSettings();
});

ipcMain.handle('save-api-key', (event, apiKey) => {
  const settings = loadSettings();
  settings.apiKey = apiKey;
  saveSettings(settings);
  openai = new OpenAI({ apiKey });
  return true;
});

ipcMain.handle('scan-folder', async (event, folderPath) => {
  const files = [];
  
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith('.')) {
        const filePath = path.join(folderPath, entry.name);
        const stats = fs.statSync(filePath);
        
        files.push({
          name: entry.name,
          path: filePath,
          size: stats.size,
          extension: path.extname(entry.name).toLowerCase(),
          modified: stats.mtime
        });
      }
    }
  } catch (e) {
    console.error('Failed to scan folder:', e);
  }
  
  return files;
});

ipcMain.handle('analyze-files', async (event, files, apiKey) => {
  if (!openai && apiKey) {
    openai = new OpenAI({ apiKey });
  }
  
  if (!openai) {
    throw new Error('API key not configured');
  }
  
  const fileList = files.map(f => `${f.name} (${f.extension}, ${formatSize(f.size)})`).join('\n');
  
  const prompt = `You are a file organization assistant. Analyze these files and suggest which folder each should go into.

Files to organize:
${fileList}

Respond with a JSON array where each object has:
- "name": the filename
- "folder": suggested folder path (e.g., "Documents/Invoices", "Images/Screenshots", "Music", "Videos", "Archives", "Code", "Other")
- "confidence": "high", "medium", or "low"
- "reason": brief reason for the suggestion

Be smart about categorization:
- Receipts, invoices, statements → Documents/Finance
- Screenshots → Images/Screenshots  
- Photos with dates → Images/Photos/[Year]
- Music files → Music/[Artist if detectable]
- Code files (.js, .py, .ts, etc) → Code
- Archives (.zip, .tar, etc) → Archives
- Installers (.dmg, .exe, .pkg) → Installers

Respond ONLY with valid JSON array, no other text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    });
    
    const content = response.choices[0].message.content;
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (e) {
    console.error('AI analysis failed:', e);
    throw new Error('Failed to analyze files: ' + e.message);
  }
});

ipcMain.handle('execute-moves', async (event, moves, baseFolder) => {
  const results = [];
  const historyEntry = {
    timestamp: new Date().toISOString(),
    baseFolder,
    moves: []
  };
  
  for (const move of moves) {
    try {
      const sourcePath = move.sourcePath;
      const destFolder = path.join(baseFolder, move.folder);
      const destPath = path.join(destFolder, move.name);
      
      // Create destination folder if it doesn't exist
      if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder, { recursive: true });
      }
      
      // Check if destination file already exists
      if (fs.existsSync(destPath)) {
        results.push({ name: move.name, success: false, error: 'File already exists at destination' });
        continue;
      }
      
      // Move the file
      fs.renameSync(sourcePath, destPath);
      
      historyEntry.moves.push({
        name: move.name,
        from: sourcePath,
        to: destPath
      });
      
      results.push({ name: move.name, success: true, newPath: destPath });
    } catch (e) {
      results.push({ name: move.name, success: false, error: e.message });
    }
  }
  
  if (historyEntry.moves.length > 0) {
    moveHistory.push(historyEntry);
    // Save history to disk
    const settings = loadSettings();
    settings.history = moveHistory;
    saveSettings(settings);
  }
  
  return results;
});

ipcMain.handle('undo-last', async () => {
  if (moveHistory.length === 0) {
    return { success: false, error: 'Nothing to undo' };
  }
  
  const lastEntry = moveHistory.pop();
  const results = [];
  
  for (const move of lastEntry.moves.reverse()) {
    try {
      if (fs.existsSync(move.to)) {
        fs.renameSync(move.to, move.from);
        results.push({ name: move.name, success: true });
      } else {
        results.push({ name: move.name, success: false, error: 'File not found' });
      }
    } catch (e) {
      results.push({ name: move.name, success: false, error: e.message });
    }
  }
  
  // Update saved history
  const settings = loadSettings();
  settings.history = moveHistory;
  saveSettings(settings);
  
  return { success: true, results, count: results.filter(r => r.success).length };
});

ipcMain.handle('get-history-count', () => {
  return moveHistory.length;
});

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// Load history on startup
app.whenReady().then(() => {
  const settings = loadSettings();
  if (settings.history) {
    moveHistory = settings.history;
  }
});
