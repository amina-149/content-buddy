export const credentialService = {
  encryptOAuthToken: (tokenData: any) => JSON.stringify(tokenData),
  decryptOAuthToken: (tokenString: string) => {
    try {
      const parsed = JSON.parse(tokenString);
      return parsed.access_token || parsed.accessToken || tokenString;
    } catch {
      return tokenString;
    }
  }
};
