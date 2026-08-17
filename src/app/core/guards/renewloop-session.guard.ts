import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AppSessionService } from '../services/app-session.service';

/**
 * Ensures a RenewLoop-backend (sbmint) session exists before any
 * apps/renewloop/* route activates, so every page component can assume a
 * valid token is already in place when it fires its first HTTP call.
 */
export const renewloopSessionGuard: CanActivateFn = async () => {
  try {
    await inject(AppSessionService).ensureRenewloopSession();
  } catch (err) {
    console.error('RenewLoop session login failed', err);
  }
  return true;
};
