import config from '@payload-config';
import { getPayload } from 'payload';

// getPayload caches the initialised instance per process.
export const getPayloadClient = () => getPayload({ config });
