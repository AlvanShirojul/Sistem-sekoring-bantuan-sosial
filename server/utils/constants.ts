/**
 * Application constants and configuration
 */

export const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';

export const PUBLIC_ROUTES = ['/register', '/login', '/health', '/debug/users'];

export const UPLOAD_SIZE_LIMIT = '50mb';

export const VALID_BENEFICIARY_STATUS = ['Sangat Layak', 'Layak', 'Tidak Layak'];

export const DEFAULT_BENEFICIARY_SCORE = 0.5;

export const DEFAULT_BENEFICIARY_STATUS = 'Pending';

export const BATCH_INSERT_CHUNK_SIZE = 500;
