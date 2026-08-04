// Auth shapes — mirror POST /auth/login and /auth/signup responses.

export interface AdminUser {
  id: string;
  email: string;
  is_admin?: boolean;
}

export interface LoginResponse {
  token: string;
  user: AdminUser;
}

export interface Credentials {
  email: string;
  password: string;
}
