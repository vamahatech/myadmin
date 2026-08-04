import { Injectable } from '@angular/core';

// Thin wrapper over localStorage so the token lives in one place and is easy to
// swap (e.g. to sessionStorage or in-memory) later.
const TOKEN_KEY = 'kia_admin_token';

@Injectable({ providedIn: 'root' })
export class StorageService {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }
}
