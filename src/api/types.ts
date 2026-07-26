export type ApplicationConfig = {
  applicationId: string;
  brandingRemovable: boolean;
};

export type AccountProfile = {
  email: string;
  pinEnrolled: boolean;
};

export type AccountBlobsResponse = {
  wrappedIdentityKey: {
    formatVersion: number;
    nonce: string;
    ciphertext: string;
  };
  passwordUnlock: {
    formatVersion: number;
    method: "password";
    nonce: string;
    ciphertext: string;
    salt: string;
    argon2Params: {
      memoryCostKib: number;
      iterations: number;
      parallelism: number;
    };
  };
  recoveryUnlock: {
    formatVersion: number;
    method: "recovery-key";
    nonce: string;
    ciphertext: string;
  };
};

export type ChallengeResponse = {
  challengeId: string;
  nonce: string;
  context: string;
  issuedAt: number;
};

export type VerifyLoginResponse = {
  sessionToken: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
};

export type RegisterAccountBody = {
  email: string;
  identityPublicKey: string;
  wrappedIdentityKey: unknown;
  passwordUnlock: unknown;
  recoveryUnlock: unknown;
  verificationToken: string;
  pinVerificationHash?: unknown;
  pinUnlock?: unknown;
};

export type ForgotPasswordResponse = {
  pinUnlock: unknown;
  wrappedIdentityKey: unknown;
};

export type AuthorizePasswordChangeBody = {
  challengeId: string;
  signature: string;
  newPasswordUnlock: unknown;
  staySignedIn?: boolean;
};

export type AuthorizePasswordChangeResponse = {
  sessionToken: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
};
