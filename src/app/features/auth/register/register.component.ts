import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['../login/login.component.scss'] // Reusing login styles for consistency
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  registerForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  errorMessage = '';
  loading = false;

  passwordMatchValidator(g: any) {
    return g.get('password').value === g.get('confirmPassword').value
      ? null : { mismatch: true };
  }

  async onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { email, password } = this.registerForm.getRawValue();

    try {
      const { error } = await this.supabase.signUpWithEmail(email, password);
      if (error) throw error;
      // Navigate to login or main depending on email confirmation requirement
      this.router.navigate(['/main']);
    } catch (err: any) {
      if (err.message.includes('User already registered')) {
        this.errorMessage = 'El correo ya está registrado.';
      } else {
        this.errorMessage = 'Error en el registro: ' + err.message;
      }
    } finally {
      this.loading = false;
    }
  }
}
