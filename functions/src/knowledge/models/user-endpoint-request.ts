export type UserEndpointRequest<T = unknown> = {
  data: T;
  authUid?: string;
  idToken?: string;
  appCheckToken?: string;
  emulator: boolean;
};
