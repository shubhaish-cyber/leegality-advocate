import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}-${Date.now()}${ext}`);
  },
});

const allowedMimes = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  // Videos
  'video/mp4',
  'video/quicktime', // .mov
  // Documents
  'application/pdf',
];

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, MP4, MOV, and PDF files are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB (videos can be large; per-type checks in route)
  },
});

/** Derive media type from MIME type */
export function getMediaType(mimetype: string): 'image' | 'video' | 'document' {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype === 'application/pdf') return 'document';
  return 'image'; // fallback
}

/** Per-type size limits in bytes */
const SIZE_LIMITS: Record<string, number> = {
  image: 5 * 1024 * 1024,      // 5MB
  document: 10 * 1024 * 1024,  // 10MB
  video: 100 * 1024 * 1024,    // 100MB
};

/** Validate file size against per-type limit. Returns error message or null. */
export function validateFileSize(file: Express.Multer.File): string | null {
  const type = getMediaType(file.mimetype);
  const limit = SIZE_LIMITS[type];
  if (file.size > limit) {
    const limitMB = limit / (1024 * 1024);
    return `${type.charAt(0).toUpperCase() + type.slice(1)} files must be under ${limitMB}MB`;
  }
  return null;
}
