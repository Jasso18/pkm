import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  await supabaseService.initialized;

  if (supabaseService.currentUser()) {
    return true;
  }

  // Not logged in, redirect to login
  return router.parseUrl('/login');
};
