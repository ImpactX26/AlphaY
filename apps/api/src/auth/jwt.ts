import * as jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthUser {
  userId: string;
  role: 'applicant' | 'staff' | 'employer';
  applicantId: string | null;
  name: string;
  email: string;
}

export function signToken(u: AuthUser): string {
  return jwt.sign(u, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthUser;
  } catch {
    return null;
  }
}
