import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
  { path: 'main', canActivate: [authGuard], loadComponent: () => import('./features/main-menu/main-menu.component').then(m => m.MainMenuComponent) },
  { path: 'collection', canActivate: [authGuard], loadComponent: () => import('./features/collection/collection.component').then(m => m.CollectionComponent) },
  { path: 'deck-builder', canActivate: [authGuard], loadComponent: () => import('./features/deck-builder/deck-builder.component').then(m => m.DeckBuilderComponent) },
  { path: 'battle', canActivate: [authGuard], loadComponent: () => import('./features/battlefield/battlefield.component').then(m => m.BattlefieldComponent) },
  { path: 'history', canActivate: [authGuard], loadComponent: () => import('./features/match-history/match-history.component').then(m => m.MatchHistoryComponent) },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
