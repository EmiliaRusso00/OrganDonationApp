const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let db;

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'tasks.db');
  db = new Database(dbPath);

  // 1) Creo la tabella se non esiste
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT,
      duration INTEGER,
      description TEXT,
      status TEXT,
      dependencies TEXT,
      note TEXT
    )
  `);

  // 2) Svuoto sempre la tabella
  db.exec('DELETE FROM tasks');

  // 3) Carico il JSON e reinserisco
  const dataPath = app.isPackaged
      ? path.join(process.resourcesPath, 'data', 'data.json') // da asar
      : path.join(__dirname, 'data', 'data.json');            // da sorgente

    // 4) Controllo che esista prima di leggerlo
    if (!fs.existsSync(dataPath)) {
      console.error('File data.json non trovato in:', dataPath);
      return;
    }

  const tasksData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const insert = db.prepare(`
    INSERT INTO tasks
    (id, name, duration, description, status, dependencies, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((tasks) => {
    for (const t of tasks) {
      insert.run(
        t.id,
        t.name,
        t.duration,
        t.description || '',
        t.status || 'non_iniziato',
        JSON.stringify(t.dependencies || []),
        t.note || ''
      );
    }
  });

  try {
    insertMany(tasksData);
    console.log(`Database reinizializzato con ${tasksData.length} tasks`);
  } catch (err) {
    console.error('Errore durante l’inserimento dei tasks:', err);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  win.loadFile('frontend/index.html');
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC
ipcMain.handle('get-tasks', () => {
  const stmt = db.prepare('SELECT * FROM tasks ORDER BY CAST(id AS INTEGER)');
  const tasks = stmt.all().map(t => ({ ...t, dependencies: JSON.parse(t.dependencies) }));
  console.log("📦 Tasks caricati:", tasks);
  return tasks;
});


ipcMain.handle('update-task', (e, { id, status, note }) => {
  const stmt = db.prepare(`
    UPDATE tasks
    SET status = COALESCE(?, status),
        note   = COALESCE(?, note)
    WHERE id = ?
  `);
  const info = stmt.run(status, note, id);
  return { changes: info.changes };
});
