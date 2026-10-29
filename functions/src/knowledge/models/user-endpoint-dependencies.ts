export type UserEndpointDependencies = {
  verifyAuth(token: string): Promise<string | null>;
  verifyAppCheck(token: string): Promise<boolean>;
};
