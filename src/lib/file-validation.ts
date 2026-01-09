/**
 * File Validation Constants
 *
 * Centralized constants for file validation to ensure consistency
 * between frontend and backend validation.
 *
 * Base64 Encoding Overhead:
 * - Base64 encoding increases size by ~33%
 * - 50MB file → ~66MB when Base64 encoded
 * - To stay under 50MB limit, actual file must be ≤37.5MB
 */

export const FILE_VALIDATION = {
  /** Maximum file size in megabytes (user-facing limit) */
  MAX_FILE_SIZE_MB: 50,

  /** Maximum file size in bytes (frontend validation) */
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,

  /**
   * Maximum Base64-encoded file size in bytes
   *
   * Formula: floor((50MB / 4) * 3) ≈ 37.5MB
   * This ensures the Base64-encoded version stays under 50MB
   */
  MAX_FILE_SIZE_ENCODED_BYTES: Math.floor((50 * 1024 * 1024) / 4) * 3,

  /** Allowed MIME types for file upload */
  ALLOWED_MIME_TYPES: [
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "text/csv",
    "application/csv",
    "application/pdf",
  ] as const,

  /** Maximum PDF pages to prevent parsing timeout */
  MAX_pdf_PAGES: 1000,

  /** PDF parsing timeout in milliseconds */
  PDF_PARSING_TIMEOUT_MS: 5000,

  /** Magic numbers (file signatures) for validation */
  FILE_SIGNATURES: {
    xlsx: [0x50, 0x4b, 0x03, 0x04], // ZIP header (XLSX is ZIP-based)
    xls: [0xd0, 0xcf, 0x11, 0xe0], // OLE header
    pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
    csv: [], // Text-based, no signature
  } as const,
} as const;

/**
 * Validate file signature (magic number)
 *
 * @param buffer - File buffer to validate
 * @param extension - File extension (e.g., ".xlsx", ".pdf")
 * @returns true if signature matches, false otherwise
 */
export function validateFileSignature(
  buffer: Buffer,
  extension: string
): boolean {
  // Skip CSV files (text-based, no signature)
  if (extension === ".csv") {
    return true;
  }

  // Get expected signature for extension
  const ext = extension.slice(1).toLowerCase(); // Remove dot
  const signature = FILE_VALIDATION.FILE_SIGNATURES[ext as keyof typeof FILE_VALIDATION.FILE_SIGNATURES];

  if (!signature || signature.length === 0) {
    return false;
  }

  // Check if buffer is large enough
  if (buffer.length < signature.length) {
    return false;
  }

  // Compare bytes
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }

  return true;
}
