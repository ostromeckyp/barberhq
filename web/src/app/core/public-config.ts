import type { PublicConfig } from '../../../../scripts/config/public-config';
export const runtimeConfig: {
  build: string;
  publicConfig: PublicConfig | null;
  useEmulators: boolean;
} = {
  build: 'local',
  publicConfig: null,
  useEmulators: false,
};
