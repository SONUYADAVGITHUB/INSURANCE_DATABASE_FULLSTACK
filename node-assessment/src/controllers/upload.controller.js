const path = require('path');
const { Worker } = require('worker_threads');

const WORKER_PATH = path.join(__dirname, '..', 'workers', 'uploadWorker.js');

/**
 * POST /api/upload
 * Accepts a single .csv/.xlsx file (field name "file"), hands it off to a
 * worker_thread that does the parsing, dedupe, and inserts across all six
 * collections, then returns a summary once the worker finishes.
 *
 * The HTTP request stays open until the import completes, which is fine
 * for the assessment's data size; for much larger files this endpoint
 * could instead return a job id immediately and expose a status route,
 * but that wasn't required here.
 */
async function uploadFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send it as multipart/form-data under field "file".' });
  }

  const worker = new Worker(WORKER_PATH, {
    workerData: {
      filePath: req.file.path,
      mongoUri: process.env.MONGO_URI
    }
  });

  worker.on('message', (msg) => {
    if (msg.type === 'done') {
      res.status(200).json({ message: 'Import complete', summary: msg.summary });
    } else if (msg.type === 'error') {
      res.status(500).json({ error: 'Import failed', details: msg.message });
    } else if (msg.type === 'progress') {
      console.log(`[upload] processed ${msg.processed}/${msg.total} rows`);
    }
  });

  worker.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Worker crashed', details: err.message });
    }
  });

  worker.on('exit', (code) => {
    if (code !== 0 && !res.headersSent) {
      res.status(500).json({ error: `Worker stopped with exit code ${code}` });
    }
  });
}

module.exports = { uploadFile };
