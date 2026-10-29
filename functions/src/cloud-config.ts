import cloud from '../config/cloud.json' with { type: 'json' };

/** Public production identifiers, tracked in `functions/config/cloud.json`; no secrets. */
export const CLOUD: {
  projectId: string;
  sqlService: string;
  sqlLocation: string;
  bucket: string;
  vertexAi: { model: string; location: string; dimension: number };
  allowedOrigins: string[];
} = cloud;
