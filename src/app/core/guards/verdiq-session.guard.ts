import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AppSessionService } from '../services/app-session.service';

/**
 * Ensures a verdiq-backend session exists before any apps/verdiq/* route
 * activates, so every ported feature component can assume a valid token is
 * already in place when it fires its first HTTP call.
 */
export const verdiqSessionGuard: CanActivateFn = async () => {
  try {
    await inject(AppSessionService).ensureVerdiqSession();
  } catch (err) {
    console.error('Verdiq session login failed', err);
  }
  return true;
};
