import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { InterviewMonitorComponent } from './components/interview-monitor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [InterviewMonitorComponent],
  template: `
    <app-interview-monitor></app-interview-monitor>
  `
})
export class App {}

bootstrapApplication(App);