import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-modal.html',
  styleUrl: './user-modal.css'
})
export class UserModalComponent implements OnInit {
  protected readonly userService = inject(UserService);
  
  readonly tempName = signal<string>('');

  ngOnInit() {
    this.tempName.set(this.userService.getUserName() || '');
  }

  save() {
    const name = this.tempName().trim();
    if (name) {
      this.userService.setUserName(name);
    }
  }

  cancel() {
    this.userService.setUserName(null);
  }
}
