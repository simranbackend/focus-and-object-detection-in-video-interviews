import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProctoringService, DetectionEvent, ProctoringSession } from '../services/proctoring';
import { VideoRecordingService } from '../services/video-recording';
import { Notification } from '../services/notification';

@Component({
  selector: 'app-interview-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './interview-screen.html',
  styleUrls: ['./interview-screen.css']
})

export class InterviewMonitorComponent implements OnInit, OnDestroy {
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
    private notify: Notification,
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

  ngOnDestroy() {
    this.cleanup();
  }

  async startInterview() {
    if (!this.candidateName.trim()) {
      this.notify.error('Candidate name is required.');
      return;
    };
    
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
      this.notify.success('Interview started successfully!');
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
      this.notify.success('Interview ended. Report ready.');
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