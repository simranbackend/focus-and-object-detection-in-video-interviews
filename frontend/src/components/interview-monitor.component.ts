import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProctoringService, DetectionEvent, ProctoringSession } from '../services/proctoring.service';
import { VideoRecordingService } from '../services/video-recording.service';

@Component({
  selector: 'app-interview-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="interview-container">
      <!-- Header -->
      <header class="interview-header card">
        <div class="header-content">
          <h1>Video Proctoring System</h1>
          <div class="session-info">
            <span *ngIf="candidateName">Candidate: <strong>{{ candidateName }}</strong></span>
            <div class="integrity-score" [class]="getScoreClass()">
              Integrity Score: {{ integrityScore }}/100
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Video Section -->
        <section class="video-section card">
          <div class="video-header">
            <h2>Live Interview Feed</h2>
            <div class="video-controls">
              <button 
                *ngIf="!isSessionActive" 
                class="btn btn-primary"
                (click)="startInterview()"
                [disabled]="!candidateName.trim()">
                <span class="status-dot"></span>
                Start Interview
              </button>
              <button 
                *ngIf="isSessionActive" 
                class="btn btn-danger"
                (click)="endInterview()">
                <span class="status-dot"></span>
                End Interview
              </button>
            </div>
          </div>
          
          <div class="video-container">
            <video 
              #videoElement 
              autoplay 
              muted 
              playsinline
              class="candidate-video">
            </video>
            <div class="video-overlay" *ngIf="isSessionActive">
              <div class="recording-indicator pulse">
                <span class="status-dot"></span>
                RECORDING
              </div>
            </div>
          </div>

          <!-- Candidate Info Input -->
          <div class="candidate-input" *ngIf="!isSessionActive">
            <label for="candidateName">Candidate Name:</label>
            <input 
              id="candidateName"
              type="text" 
              [(ngModel)]="candidateName" 
              placeholder="Enter candidate name"
              class="form-input">
          </div>
        </section>

        <!-- Monitoring Dashboard -->
        <section class="monitoring-section card">
          <h2>Real-time Monitoring</h2>
          
          <!-- Status Indicators -->
          <div class="status-grid">
            <div class="status-item">
              <span class="status-label">Face Detection:</span>
              <span class="status-indicator" [class]="getFaceStatus().class">
                <span class="status-dot"></span>
                {{ getFaceStatus().text }}
              </span>
            </div>
            
            <div class="status-item">
              <span class="status-label">Focus Status:</span>
              <span class="status-indicator" [class]="getFocusStatus().class">
                <span class="status-dot"></span>
                {{ getFocusStatus().text }}
              </span>
            </div>
            
            <div class="status-item">
              <span class="status-label">Object Detection:</span>
              <span class="status-indicator" [class]="getObjectStatus().class">
                <span class="status-dot"></span>
                {{ getObjectStatus().text }}
              </span>
            </div>
            
            <div class="status-item">
              <span class="status-label">Session Duration:</span>
              <span class="session-timer">{{ getSessionDuration() }}</span>
            </div>
          </div>

          <!-- Event Counts -->
          <div class="event-summary" *ngIf="isSessionActive">
            <h3>Violation Summary</h3>
            <div class="event-counts">
              <div class="event-count">
                <span class="count">{{ eventCounts['focus_loss'] || 0 }}</span>
                <span class="label">Focus Loss</span>
              </div>
              <div class="event-count">
                <span class="count">{{ eventCounts['face_missing'] || 0 }}</span>
                <span class="label">Face Missing</span>
              </div>
              <div class="event-count">
                <span class="count">{{ eventCounts['multiple_faces'] || 0 }}</span>
                <span class="label">Multiple Faces</span>
              </div>
              <div class="event-count">
                <span class="count">{{ eventCounts['unauthorized_object'] || 0 }}</span>
                <span class="label">Unauthorized Objects</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Recent Events -->
      <section class="events-section card" *ngIf="recentEvents.length > 0">
        <h2>Recent Alerts</h2>
        <div class="events-list">
          <div 
            *ngFor="let event of recentEvents.slice(-5).reverse()" 
            class="event-item fade-in"
            [class]="'severity-' + event.severity">
            <div class="event-icon">!</div>
            <div class="event-content">
              <div class="event-description">{{ event.description }}</div>
              <div class="event-time">{{ formatTime(event.timestamp) }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Final Report -->
      <section class="report-section card" *ngIf="completedSession">
        <h2>Interview Report</h2>
        <div class="report-content">
          <div class="report-header">
            <h3>{{ completedSession.candidateName }}</h3>
            <div class="report-meta">
              <span>Duration: {{ getReportDuration() }}</span>
              <span>Final Score: {{ completedSession.integrityScore }}/100</span>
            </div>
          </div>
          
          <div class="report-summary">
            <div class="summary-item">
              <strong>Total Violations:</strong> {{ completedSession.events.length }}
            </div>
            <div class="summary-item">
              <strong>Severity Breakdown:</strong>
              <span>High: {{ getViolationsBySeverity('high') }}</span>
              <span>Medium: {{ getViolationsBySeverity('medium') }}</span>
              <span>Low: {{ getViolationsBySeverity('low') }}</span>
            </div>
          </div>
          
          <div class="report-actions">
            <button class="btn btn-primary" (click)="downloadReport()">
              Download Report
            </button>
            <button class="btn btn-secondary" (click)="downloadRecording()" [disabled]="!recordedVideo">
              Download Recording
            </button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .interview-container {
      min-height: 100vh;
      background: #f8fafc;
      padding: 1rem;
    }

    .interview-header {
      margin-bottom: 1.5rem;
      padding: 1.5rem;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-content h1 {
      color: #1e293b;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .session-info {
      display: flex;
      gap: 2rem;
      align-items: center;
    }

    .integrity-score {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 1.1rem;
    }

    .score-excellent { background: #dcfce7; color: #166534; }
    .score-good { background: #fef3c7; color: #92400e; }
    .score-poor { background: #fee2e2; color: #991b1b; }

    .main-content {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .video-section, .monitoring-section {
      padding: 1.5rem;
    }

    .video-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .video-header h2 {
      color: #1e293b;
      font-size: 1.25rem;
    }

    .video-container {
      position: relative;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 1rem;
    }

    .candidate-video {
      width: 100%;
      height: 400px;
      object-fit: cover;
    }

    .video-overlay {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: rgba(239, 68, 68, 0.9);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .recording-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .candidate-input {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .candidate-input label {
      font-weight: 500;
      color: #374151;
    }

    .form-input {
      padding: 0.75rem;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .monitoring-section h2 {
      color: #1e293b;
      font-size: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .status-grid {
      display: grid;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: #f8fafc;
      border-radius: 8px;
    }

    .status-label {
      font-weight: 500;
      color: #64748b;
    }

    .session-timer {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: #1e293b;
    }

    .event-summary h3 {
      color: #1e293b;
      font-size: 1.1rem;
      margin-bottom: 1rem;
    }

    .event-counts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .event-count {
      text-align: center;
      padding: 1rem;
      background: #f1f5f9;
      border-radius: 8px;
    }

    .event-count .count {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      color: #dc2626;
    }

    .event-count .label {
      font-size: 0.875rem;
      color: #64748b;
    }

    .events-section, .report-section {
      padding: 1.5rem;
    }

    .events-section h2, .report-section h2 {
      color: #1e293b;
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }

    .events-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .event-item {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1rem;
      border-radius: 8px;
      border-left: 4px solid;
    }

    .severity-high {
      background: #fee2e2;
      border-left-color: #dc2626;
    }

    .severity-medium {
      background: #fef3c7;
      border-left-color: #f59e0b;
    }

    .severity-low {
      background: #e0f2fe;
      border-left-color: #0ea5e9;
    }

    .event-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: currentColor;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      flex-shrink: 0;
    }

    .event-content {
      flex: 1;
    }

    .event-description {
      font-weight: 500;
      margin-bottom: 0.25rem;
    }

    .event-time {
      font-size: 0.875rem;
      color: #64748b;
    }

    .report-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .report-header {
      padding-bottom: 1rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .report-header h3 {
      font-size: 1.5rem;
      color: #1e293b;
      margin-bottom: 0.5rem;
    }

    .report-meta {
      display: flex;
      gap: 2rem;
      color: #64748b;
    }

    .report-summary {
      display: grid;
      gap: 0.75rem;
    }

    .summary-item {
      padding: 0.75rem;
      background: #f8fafc;
      border-radius: 8px;
    }

    .summary-item strong {
      color: #1e293b;
      margin-right: 0.5rem;
    }

    .summary-item span {
      margin-right: 1rem;
    }

    .report-actions {
      display: flex;
      gap: 1rem;
    }

    @media (max-width: 1024px) {
      .main-content {
        grid-template-columns: 1fr;
      }
      
      .header-content {
        flex-direction: column;
        gap: 1rem;
      }
      
      .session-info {
        flex-direction: column;
        gap: 0.5rem;
      }
    }

    @media (max-width: 768px) {
      .interview-container {
        padding: 0.5rem;
      }
      
      .candidate-video {
        height: 250px;
      }
      
      .event-counts {
        grid-template-columns: 1fr;
      }
      
      .report-actions {
        flex-direction: column;
      }
    }
  `]
})
export class InterviewMonitorComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  
  candidateName = '';
  isSessionActive = false;
  integrityScore = 100;
  recentEvents: DetectionEvent[] = [];
  eventCounts: { [key: string]: number } = {};
  completedSession: ProctoringSession | null = null;
  recordedVideo: Blob | null = null;
  
  private analysisInterval: number | null = null;
  private timerInterval: number | null = null;
  private sessionStartTime: Date | null = null;

  constructor(
    private proctoringService: ProctoringService,
    private videoRecordingService: VideoRecordingService
  ) {}

  async ngOnInit() {
    try {
      await this.proctoringService.initialize();
      console.log('Proctoring service initialized');
    } catch (error) {
      console.error('Failed to initialize proctoring service:', error);
      alert('Failed to initialize monitoring system. Please refresh and try again.');
    }
  }

  ngAfterViewInit() {
    // Initial setup after view is ready
  }

  ngOnDestroy() {
    this.cleanup();
  }

  async startInterview() {
    if (!this.candidateName.trim()) return;
    
    try {
      // Start video recording
      await this.videoRecordingService.startRecording(this.videoElement.nativeElement);
      
      // Start proctoring session
      this.proctoringService.startSession(this.candidateName);
      
      this.isSessionActive = true;
      this.sessionStartTime = new Date();
      this.recentEvents = [];
      this.eventCounts = {};
      
      // Start analysis loop
      this.startAnalysis();
      
      // Start timer update
      this.startTimer();
      
      console.log('Interview started for:', this.candidateName);
    } catch (error) {
      console.error('Failed to start interview:', error);
      alert('Failed to start interview. Please check camera permissions.');
    }
  }

  async endInterview() {
    try {
      // Stop recording
      this.recordedVideo = await this.videoRecordingService.stopRecording();
      
      // End proctoring session
      this.completedSession = this.proctoringService.endSession();
      
      this.isSessionActive = false;
      this.cleanup();
      
      console.log('Interview ended. Final score:', this.completedSession?.integrityScore);
    } catch (error) {
      console.error('Failed to end interview:', error);
    }
  }

  private startAnalysis() {
    this.analysisInterval = window.setInterval(async () => {
      if (this.videoElement?.nativeElement) {
        const events = await this.proctoringService.analyzeFrame(this.videoElement.nativeElement);
        
        events.forEach(event => {
          this.recentEvents.push(event);
        });
        
        // Update scores and counts
        this.integrityScore = this.proctoringService.getIntegrityScore();
        this.eventCounts = this.proctoringService.getEventCount();
      }
    }, 1000); // Analyze every second
  }

  private startTimer() {
    this.timerInterval = window.setInterval(() => {
      // Timer update handled in template
    }, 1000);
  }

  private cleanup() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getScoreClass(): string {
    if (this.integrityScore >= 80) return 'score-excellent';
    if (this.integrityScore >= 60) return 'score-good';
    return 'score-poor';
  }

  getFaceStatus() {
    const recentFaceEvents = this.recentEvents
      .filter(e => e.type === 'face_missing')
      .slice(-1);
    
    if (recentFaceEvents.length > 0) {
      return { class: 'status-danger', text: 'No Face Detected' };
    }
    
    const multipleFactEvents = this.recentEvents
      .filter(e => e.type === 'multiple_faces')
      .slice(-1);
      
    if (multipleFactEvents.length > 0) {
      return { class: 'status-warning', text: 'Multiple Faces' };
    }
    
    return { class: 'status-good', text: 'Face Detected' };
  }

  getFocusStatus() {
    const recentFocusEvents = this.recentEvents
      .filter(e => e.type === 'focus_loss')
      .slice(-1);
    
    if (recentFocusEvents.length > 0) {
      return { class: 'status-warning', text: 'Looking Away' };
    }
    
    return { class: 'status-good', text: 'Focused' };
  }

  getObjectStatus() {
    const recentObjectEvents = this.recentEvents
      .filter(e => e.type === 'unauthorized_object')
      .slice(-1);
    
    if (recentObjectEvents.length > 0) {
      const event = recentObjectEvents[0];
      return { class: 'status-danger', text: `${event.details?.object} Detected` };
    }
    
    return { class: 'status-good', text: 'No Objects' };
  }

  getSessionDuration(): string {
    if (!this.sessionStartTime) return '00:00';
    
    const now = new Date();
    const diff = now.getTime() - this.sessionStartTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  getReportDuration(): string {
    if (!this.completedSession?.startTime || !this.completedSession?.endTime) return '00:00';
    
    const diff = this.completedSession.endTime.getTime() - this.completedSession.startTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  getViolationsBySeverity(severity: string): number {
    return this.completedSession?.events.filter(e => e.severity === severity).length || 0;
  }

  formatTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString();
  }

  downloadReport() {
    if (!this.completedSession) return;
    
    const report = {
      candidate: this.completedSession.candidateName,
      startTime: this.completedSession.startTime,
      endTime: this.completedSession.endTime,
      duration: this.getReportDuration(),
      integrityScore: this.completedSession.integrityScore,
      totalViolations: this.completedSession.events.length,
      violationsByType: this.eventCounts,
      violationsBySeverity: {
        high: this.getViolationsBySeverity('high'),
        medium: this.getViolationsBySeverity('medium'),
        low: this.getViolationsBySeverity('low')
      },
      events: this.completedSession.events
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-report-${this.completedSession.candidateName}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadRecording() {
    if (!this.recordedVideo || !this.completedSession) return;
    
    const filename = `interview-recording-${this.completedSession.candidateName}-${new Date().toISOString().split('T')[0]}.webm`;
    this.videoRecordingService.downloadRecording(this.recordedVideo, filename);
  }
}