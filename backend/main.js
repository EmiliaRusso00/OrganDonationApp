const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
// Libreria sincrona per SQLite
const Database = require('better-sqlite3');

let db;

function initDatabase() {
  // Percorso del file tasks.db
  const dbPath = path.join(app.getPath('userData'), 'tasks.db');
  const dbEsisteGia = fs.existsSync(dbPath);

  db = new Database(dbPath);

  // Crea la tabella se non esiste
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

  // Se la tabella è già popolata, non fare nulla
  const count = db.prepare('SELECT COUNT(*) AS totale FROM tasks').get();
  if (count.totale > 0) {
    console.log('Database già popolato. Nessuna inizializzazione necessaria.');
    return;
  }

  // Se è vuoto, carica i dati iniziali da data.json
  const dataPath = app.isPackaged
    ? path.join(process.resourcesPath, 'data', 'data.json')
    : path.join(__dirname, 'data', 'data.json');

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
    console.log(`Database inizializzato con ${tasksData.length} tasks`);
  } catch (err) {
    console.error('Errore durante l’inserimento dei tasks:', err);
  }
}


// Crea la finestra della web app
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // isola JavaScript da Node.js
      nodeIntegration: false,
    }
  });

  win.loadFile('frontend/index.html');
}

// Avvio dell'app: database e finestra
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

// IPC: recupero ordinato dei task
ipcMain.handle('get-tasks', () => {
  const stmt = db.prepare('SELECT * FROM tasks ORDER BY CAST(id AS INTEGER)');
  const tasks = stmt.all().map(t => ({
    ...t,
    dependencies: JSON.parse(t.dependencies)
  }));
  return tasks;
});

// IPC: aggiornamento task (status e/o note)
ipcMain.handle('update-task', (e, { id, status, note }) => {
  console.log('[MAIN] update-task invocato con:', {
    id,
    typeOfId: typeof id,
    status,
    note
  });

  const stmt = db.prepare(`
    UPDATE tasks
    SET status = COALESCE(?, status),
        note   = COALESCE(?, note)
    WHERE CAST(id AS INTEGER) = ?
  `);

  const info = stmt.run(status, note, id);
  console.log('[MAIN] SQLite info.changes =', info.changes);
  return { changes: info.changes };
});

// IPC: reset completo del database (elimina e reinizializza da data.json)
ipcMain.handle('reset-database', () => {
  try {
    // Elimina tutti i task
    const deleted = db.prepare('DELETE FROM tasks').run();
    console.log(`[MAIN] Tasks cancellati: ${deleted.changes}`);

    // Percorso del file data.json
    const dataPath = app.isPackaged
      ? path.join(process.resourcesPath, 'data', 'data.json')
      : path.join(__dirname, 'data', 'data.json');

    if (!fs.existsSync(dataPath)) {
      const errMsg = `File data.json non trovato in: ${dataPath}`;
      console.error(errMsg);
      return { success: false, error: errMsg };
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

    insertMany(tasksData);
    console.log(`[MAIN] Database reinizializzato con ${tasksData.length} task da data.json`);

    return { success: true, reloaded: tasksData.length };
  } catch (err) {
    console.error('[MAIN] Errore nel reset del database:', err);
    return { success: false, error: err.message };
  }
});
