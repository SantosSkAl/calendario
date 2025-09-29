import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
// import { NewTask } from '../task/task.model';
// import { TaskService } from '../tasks.service';
// import { User } from '../../user/user.model';

@Component({
  selector: 'app-new-task',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './new-task.component.html',
  styleUrl: './new-task.component.css'
})
export class NewTaskComponent {
  // @Input({ required: true }) user!: User;
  @Output() close = new EventEmitter<void>();
  // @Output() add = new EventEmitter<NewTask>();
  enteredTitle = ''
  enteredSummary = ''
  enderedDate = ''
  // private taskService = inject(TaskService)
  
  onClose() {
    this.close.emit()
  }

  onSubmit() {
    // this.taskService.addTask({
    //   title: this.enteredTitle,
    //   summary: this.enteredSummary,
    //   dueDate: this.enderedDate,
    // }, this.user.id)
    // this.close.emit()
    console.log('bam')
  }
}
