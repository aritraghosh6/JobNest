const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

const FILE_KINDS = {
  document: {
    mimetypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    extensions: ['.pdf', '.docx'],
    label: 'PDF or DOCX',
  },
  image: {
    mimetypes: ['image/png', 'image/jpeg', 'image/webp'],
    extensions: ['.png', '.jpg', '.jpeg', '.webp'],
    label: 'PNG, JPG or WEBP',
  },
  verification: {
    mimetypes: ['application/pdf', 'image/png', 'image/jpeg'],
    extensions: ['.pdf', '.png', '.jpg', '.jpeg'],
    label: 'PDF, PNG or JPG',
  },
};

function fileFilterFor(kind) {
  const rule = FILE_KINDS[kind];
  return (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!rule.extensions.includes(ext) || !rule.mimetypes.includes(file.mimetype)) {
      return cb(new AppError(400, `Unsupported file type. Please upload a ${rule.label} file.`));
    }
    cb(null, true);
  };
}

function diskStorage(folder) {
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    // Random name: the user's file name is never used on disk
    filename: (req, file, cb) =>
      cb(null, `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  });
}

const MB = 1024 * 1024;

const uploadSeekerDocument = multer({
  storage: diskStorage('documents'),
  fileFilter: fileFilterFor('document'),
  limits: { fileSize: 2 * MB, files: 1 },
}).single('file');

const uploadLogo = multer({
  storage: diskStorage('logos'),
  fileFilter: fileFilterFor('image'),
  limits: { fileSize: 1 * MB, files: 1 },
}).single('logo');

const uploadVerificationDocument = multer({
  storage: diskStorage('verification'),
  fileFilter: fileFilterFor('verification'),
  limits: { fileSize: 5 * MB, files: 1 },
}).single('document');

// Resumes for the ATS checker stay in memory and are never saved to disk.
const uploadResumeForAnalysis = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilterFor('document'),
  limits: { fileSize: 2 * MB, files: 1 },
}).single('resume');

module.exports = {
  UPLOAD_ROOT,
  uploadSeekerDocument,
  uploadLogo,
  uploadVerificationDocument,
  uploadResumeForAnalysis,
};
