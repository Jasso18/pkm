import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  errorMessage = '';
  loading = false;

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.getRawValue();

    try {
      const { error } = await this.supabase.signInWithEmail(email, password);
      if (error) throw error;
      this.router.navigate(['/main']);
    } catch (err: any) {
      if (err.message.includes('Invalid login credentials')) {
        this.errorMessage = 'Correo o contraseña incorrectos.';
      } else if (err.message.includes('Email not confirmed')) {
        this.errorMessage = 'Por favor, confirma tu correo electrónico antes de iniciar sesión.';
      } else {
        this.errorMessage = 'Error al iniciar sesión: ' + err.message;
      }
    } finally {
      this.loading = false;
    }
  }

  async loginWithGoogle() {
    try {
      await this.supabase.signInWithGoogle();
    } catch (err: any) {
      this.errorMessage = 'Error al iniciar sesión con Google: ' + err.message;
    }
  }
}
