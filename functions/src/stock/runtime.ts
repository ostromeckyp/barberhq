type Options = {
  emulator: boolean;
  projectId: string | undefined;
  emulatorHost: string | undefined;
  serviceId?: string;
  location?: string;
};

/** The callable's SQL destination must match its Firebase runtime profile. */
export function stockConnectorConfig({
  emulator,
  projectId,
  emulatorHost,
  serviceId,
  location,
}: Options) {
  if (emulator) {
    if (
      projectId !== 'demo-barberhq' ||
      !/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(emulatorHost ?? '')
    ) {
      throw new Error('Stock emulator requires demo-barberhq and a loopback SQL emulator host');
    }
    return { connector: 'server' as const, serviceId: 'barberhq', location: 'europe-west1' };
  }
  if (
    projectId !== 'notbad-6be95' ||
    emulatorHost ||
    serviceId !== 'notbad-6be95-service' ||
    location !== 'europe-west3'
  ) {
    throw new Error(
      'Stock cloud requires the approved production project and SQL target without an emulator host',
    );
  }
  return { connector: 'server' as const, serviceId, location };
}
