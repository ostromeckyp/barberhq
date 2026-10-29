export type AiUserRequest<T> = {
  data: T;
  authUid?: string;
  idToken?: string;
  appCheckToken?: string;
};
