// Kept in sync with backend/services/identity-service/src/interfaces/auth.ts
// — identity-service signs tokens with this shape, this service only needs
// to verify them (it never issues its own tokens).
export interface AccessTokenClaims {
  sub: string;
  email: string;
  type: "access";
}
