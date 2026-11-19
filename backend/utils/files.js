const fs = require('fs');
const path = require('path');
const AppError = require('./AppError');
const { UPLOAD_ROOT } = require('../middleware/upload');

// First bytes ("magic numbers") of each allowed file type.
const SIGNATURES = {
  '.pdf': [Buffer.from('%PDF')],
  '.docx': [Buffer.from([0x50, 0x4b, 0x03, 0x04])], // DOCX is a ZIP archive
  '.png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  '.jpg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.webp': [Buffer.from('RIFF')],
};

/** Checks that the file content really matches its extension. */
function hasValidSignature(buffer, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const signatures = SIGNATURES[ext];
  if (!signatures || !buffer) return false;
  return signatures.some((sig) => buffer.subarray(0, sig.length).equals(sig));
}

function readHead(filePath, bytes = 8) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    fs.readSync(fd, buffer, 0, bytes, 0);
    return buffer;
  } finally {
    fs.closeSync(fd);
  }
}

/** Validates an uploaded file saved on disk; deletes it and throws if it is not genuine. */
function assertUploadedFile(file) {
  if (!file) throw new AppError(400, 'Please choose a file to upload.');
  if (!hasValidSignature(readHead(file.path), file.originalname)) {
    removeFile(file.path);
    throw new AppError(400, 'The file content does not match its type. Please upload a valid file.');
  }
}

/** Metadata stored in MongoDB for an uploaded file. */
function fileMeta(file) {
  return {
    stored_name: file.filename,
    original_name: path.basename(file.originalname).slice(0, 150),
    mimetype: file.mimetype,
    size: file.size,
    uploaded_at: new Date(),
  };
}

function removeFile(filePath) {
  if (!filePath) return;
  fs.promises.unlink(filePath).catch(() => {});
}

function storedPath(folder, storedName) {
  // basename() prevents path traversal through a stored name
  return path.join(UPLOAD_ROOT, folder, path.basename(storedName));
}

/** Sends a stored private file as a download. */
function sendStoredFile(res, folder, meta) {
  if (!meta || !meta.stored_name) throw new AppError(404, 'File not found.');
  const filePath = storedPath(folder, meta.stored_name);
  if (!fs.existsSync(filePath)) throw new AppError(404, 'File not found.');
  res.download(filePath, meta.original_name);
}

module.exports = { hasValidSignature, assertUploadedFile, fileMeta, removeFile, storedPath, sendStoredFile };
