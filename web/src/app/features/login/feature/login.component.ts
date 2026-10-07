import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, email } from '@angular/forms/signals';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LoginFacade } from './login.facade';
import { Brand } from '../../../shared/ui/brand/brand';
@Component({
  selector: 'app-login',
  providers: [LoginFacade],
  imports: [
    Brand,
    FormField,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly facade = inject(LoginFacade);
  readonly model = signal({ email: '', password: '' });
  readonly fields = form(this.model, (p) => {
    required(p.email);
    email(p.email);
    required(p.password);
  });
  readonly showPassword = signal(false);
  async signIn(event: Event) {
    event.preventDefault();
    this.fields().markAsTouched();
    if (this.fields().invalid() || this.facade.busy()) return;
    try {
      await this.facade.signIn(this.model().email, this.model().password);
    } finally {
      this.model.update((m) => ({ ...m, password: '' }));
    }
  }
}
