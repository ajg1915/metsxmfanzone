// Allowed file extensions and their corresponding MIME types
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];

const ALLOWED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a'];
const ALLOWED_AUDIO_MIMES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];

// Magic bytes signatures for common file types
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a and GIF89a
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP starts with RIFF)
  'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp marker
  'video/webm': [[0x1A, 0x45, 0xDF, 0xA3]],
  'audio/mpeg': [[0xFF, 0xFB], [0xFF, 0xFA], [0xFF, 0xF3], [0x49, 0x44, 0x33]], // MP3 frames and ID3 tag
  'audio/wav': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
  'audio/ogg': [[0x4F, 0x67, 0x67, 0x53]], // OggS
};

export type FileType = 'image' | 'video' | 'audio';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Get the file extension from a filename
 */
export const getFileExtension = (filename: string): string => {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
};

/**
 * Validate file extension against allowlist
 */
export const validateExtension = (filename: string, fileType: FileType): ValidationResult => {
  const extension = getFileExtension(filename);
  
  let allowedExtensions: string[];
  switch (fileType) {
    case 'image':
      allowedExtensions = ALLOWED_IMAGE_EXTENSIONS;
      break;
    case 'video':
      allowedExtensions = ALLOWED_VIDEO_EXTENSIONS;
      break;
    case 'audio':
      allowedExtensions = ALLOWED_AUDIO_EXTENSIONS;
      break;
  }
  
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`,
    };
  }
  
  return { valid: true };
};

/**
 * Validate MIME type against allowlist
 */
export const validateMimeType = (mimeType: string, fileType: FileType): ValidationResult => {
  let allowedMimes: string[];
  switch (fileType) {
    case 'image':
      allowedMimes = ALLOWED_IMAGE_MIMES;
      break;
    case 'video':
      allowedMimes = ALLOWED_VIDEO_MIMES;
      break;
    case 'audio':
      allowedMimes = ALLOWED_AUDIO_MIMES;
      break;
  }
  
  if (!allowedMimes.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedMimes.map(m => m.split('/')[1]).join(', ')}`,
    };
  }
  
  return { valid: true };
};

/**
 * Validate file size
 */
export const validateFileSize = (size: number, maxSizeMB: number): ValidationResult => {
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (size > maxBytes) {
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB`,
    };
  }
  return { valid: true };
};

/**
 * Read the first bytes of a file to check magic bytes
 */
const readFileBytes = async (file: File, numBytes: number): Promise<Uint8Array> => {
  const slice = file.slice(0, numBytes);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
};

/**
 * Check if file bytes match any of the expected signatures
 */
const matchesMagicBytes = (fileBytes: Uint8Array, signatures: number[][]): boolean => {
  return signatures.some(signature => {
    if (fileBytes.length < signature.length) return false;
    return signature.every((byte, index) => fileBytes[index] === byte);
  });
};

const isIsoBaseMediaFile = (fileBytes: Uint8Array): boolean => {
  // MP4, M4A, and MOV files use an ISO Base Media "ftyp" box. The marker is
  // normally at byte 4, so checking only the first byte incorrectly rejects
  // videos recorded by many phones.
  return fileBytes.length >= 8
    && fileBytes[4] === 0x66
    && fileBytes[5] === 0x74
    && fileBytes[6] === 0x79
    && fileBytes[7] === 0x70;
};

/**
 * Validate file content by checking magic bytes
 */
export const validateMagicBytes = async (file: File, fileType: FileType): Promise<ValidationResult> => {
  try {
    const fileBytes = await readFileBytes(file, 12); // Read first 12 bytes

    if (
      (file.type === 'video/mp4'
        || file.type === 'video/quicktime'
        || file.type === 'audio/mp4'
        || file.type === 'audio/x-m4a')
      && isIsoBaseMediaFile(fileBytes)
    ) {
      return { valid: true };
    }
    
    let allowedMimes: string[];
    switch (fileType) {
      case 'image':
        allowedMimes = ALLOWED_IMAGE_MIMES;
        break;
      case 'video':
        allowedMimes = ALLOWED_VIDEO_MIMES;
        break;
      case 'audio':
        allowedMimes = ALLOWED_AUDIO_MIMES;
        break;
    }
    
    // Check if file matches any of the allowed MIME type signatures
    for (const mime of allowedMimes) {
      const signatures = MAGIC_BYTES[mime];
      if (signatures && matchesMagicBytes(fileBytes, signatures)) {
        return { valid: true };
      }
    }
    
    // For some formats, magic bytes verification might not be available
    // Fall back to MIME type check in those cases
    if (!Object.keys(MAGIC_BYTES).some(key => allowedMimes.includes(key))) {
      return { valid: true };
    }
    
    return {
      valid: false,
      error: 'File content does not match expected format. The file may be corrupted or disguised.',
    };
  } catch (error) {
    console.error('Error reading file bytes:', error);
    return {
      valid: false,
      error: 'Unable to verify file content',
    };
  }
};

/**
 * Generate a safe filename
 */
export const generateSafeFilename = (originalFilename: string): string => {
  const extension = getFileExtension(originalFilename);
  // Generate a random filename with timestamp to ensure uniqueness
  const randomPart = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now();
  return `${randomPart}-${timestamp}.${extension}`;
};

/**
 * Comprehensive file validation
 */
export const validateFile = async (
  file: File,
  fileType: FileType,
  maxSizeMB: number
): Promise<ValidationResult> => {
  // 1. Validate extension first (fastest check)
  const extensionResult = validateExtension(file.name, fileType);
  if (!extensionResult.valid) {
    return extensionResult;
  }
  
  // 2. Validate MIME type
  const mimeResult = validateMimeType(file.type, fileType);
  if (!mimeResult.valid) {
    return mimeResult;
  }
  
  // 3. Validate file size
  const sizeResult = validateFileSize(file.size, maxSizeMB);
  if (!sizeResult.valid) {
    return sizeResult;
  }
  
  // 4. Validate magic bytes (content verification)
  const magicBytesResult = await validateMagicBytes(file, fileType);
  if (!magicBytesResult.valid) {
    return magicBytesResult;
  }
  
  return { valid: true };
};
