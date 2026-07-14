import { Request } from "express";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
