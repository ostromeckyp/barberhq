export type AiUserDependencies = {
  verifyAuth(token: string, checkRevoked: true): Promise<string | null>;
  verifyAppCheck(token: string): Promise<boolean>;
};
