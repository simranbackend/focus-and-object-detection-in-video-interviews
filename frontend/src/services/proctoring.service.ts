import { Injectable } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface DetectionEvent {
  id: string;
  type: 'focus_loss' | 'face_missing' | 'multiple_faces' | 'unauthorized_object';
  timestamp: Date;
  description: string;
  severity: 'low' | 'medium' | 'high';
  details?: any;
}

export interface ProctoringSession {
  candidateName: string;
  startTime: Date;
  endTime?: Date;
  events: DetectionEvent[];
  integrityScore: number;
  isRecording: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ProctoringService {
  private faceDetector: faceLandmarksDetection.FaceLandmarksDetector | null = null;
  private objectDetector: cocoSsd.ObjectDetection | null = null;
  private currentSession: ProctoringSession | null = null;
  private isInitialized = false;
  private focusTimer: number | null = null;
  private faceTimer: number | null = null;
  
  // Suspicious objects to detect
  private suspiciousObjects = ['cell phone', 'book', 'laptop', 'person'];
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      await tf.ready();
      
      // Initialize face landmarks detector
      this.faceDetector = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',
          refineLandmarks: true,
        }
      );
      
      // Initialize object detector
      this.objectDetector = await cocoSsd.load();
      
      this.isInitialized = true;
      console.log('Proctoring service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize proctoring service:', error);
      throw error;
    }
  }
  
  startSession(candidateName: string): void {
    this.currentSession = {
      candidateName,
      startTime: new Date(),
      events: [],
      integrityScore: 100,
      isRecording: false
    };
  }
  
  endSession(): ProctoringSession | null {
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      this.currentSession.isRecording = false;
      
      if (this.focusTimer) {
        clearTimeout(this.focusTimer);
        this.focusTimer = null;
      }
      
      if (this.faceTimer) {
        clearTimeout(this.faceTimer);
        this.faceTimer = null;
      }
      
      const session = this.currentSession;
      this.currentSession = null;
      return session;
    }
    return null;
  }
  
  getCurrentSession(): ProctoringSession | null {
    return this.currentSession;
  }
  
  async analyzeFrame(videoElement: HTMLVideoElement): Promise<DetectionEvent[]> {
    if (!this.isInitialized || !this.faceDetector || !this.objectDetector || !this.currentSession) {
      return [];
    }
    
    const events: DetectionEvent[] = [];
    
    try {
      // Face detection and analysis
      const faces = await this.faceDetector.estimateFaces(videoElement);
      
      if (faces.length === 0) {
        // No face detected
        if (!this.faceTimer) {
          this.faceTimer = window.setTimeout(() => {
            const event = this.createEvent(
              'face_missing',
              'No face detected for more than 10 seconds',
              'high',
              { duration: 10 }
            );
            events.push(event);
            this.addEventToSession(event);
            this.faceTimer = null;
          }, 10000);
        }
      } else {
        // Face detected - clear timer
        if (this.faceTimer) {
          clearTimeout(this.faceTimer);
          this.faceTimer = null;
        }
        
        if (faces.length > 1) {
          // Multiple faces detected
          const event = this.createEvent(
            'multiple_faces',
            `${faces.length} faces detected in frame`,
            'medium',
            { faceCount: faces.length }
          );
          events.push(event);
          this.addEventToSession(event);
        }
        
        // Analyze gaze direction (simplified)
        const face = faces[0];
        if (face.keypoints) {
          const isLookingAway = this.analyzeFocusDirection(face.keypoints);
          
          if (isLookingAway) {
            if (!this.focusTimer) {
              this.focusTimer = window.setTimeout(() => {
                const event = this.createEvent(
                  'focus_loss',
                  'Candidate looking away for more than 5 seconds',
                  'medium',
                  { duration: 5 }
                );
                events.push(event);
                this.addEventToSession(event);
                this.focusTimer = null;
              }, 5000);
            }
          } else {
            // Looking at screen - clear timer
            if (this.focusTimer) {
              clearTimeout(this.focusTimer);
              this.focusTimer = null;
            }
          }
        }
      }
      
      // Object detection
      const detectedObjects = await this.objectDetector.detect(videoElement);
      const suspiciousDetections = detectedObjects.filter(obj => 
        this.suspiciousObjects.some(suspicious => 
          obj.class.toLowerCase().includes(suspicious.toLowerCase())
        )
      );
      
      for (const obj of suspiciousDetections) {
        const event = this.createEvent(
          'unauthorized_object',
          `Detected ${obj.class} in frame`,
          'high',
          { object: obj.class, confidence: obj.score }
        );
        events.push(event);
        this.addEventToSession(event);
      }
      
    } catch (error) {
      console.error('Error analyzing frame:', error);
    }
    
    return events;
  }
  
  private analyzeFocusDirection(keypoints: any[]): boolean {
    // Simplified gaze detection based on eye landmarks
    // In a production system, this would be more sophisticated
    try {
      const leftEye = keypoints.slice(33, 42);
      const rightEye = keypoints.slice(362, 371);
      const nose = keypoints[1];
      
      // Basic heuristic: if nose is significantly off-center relative to eyes
      if (leftEye.length > 0 && rightEye.length > 0 && nose) {
        const eyeCenter = {
          x: (leftEye[0].x + rightEye[0].x) / 2,
          y: (leftEye[0].y + rightEye[0].y) / 2
        };
        
        const noseOffset = Math.abs(nose.x - eyeCenter.x);
        return noseOffset > 50; // Threshold for "looking away"
      }
    } catch (error) {
      console.error('Error analyzing focus direction:', error);
    }
    
    return false;
  }
  
  private createEvent(
    type: DetectionEvent['type'],
    description: string,
    severity: DetectionEvent['severity'],
    details?: any
  ): DetectionEvent {
    return {
      id: this.generateId(),
      type,
      timestamp: new Date(),
      description,
      severity,
      details
    };
  }
  
  private addEventToSession(event: DetectionEvent): void {
    if (this.currentSession) {
      this.currentSession.events.push(event);
      
      // Deduct points from integrity score
      const deduction = event.severity === 'high' ? 10 : event.severity === 'medium' ? 5 : 2;
      this.currentSession.integrityScore = Math.max(0, this.currentSession.integrityScore - deduction);
    }
  }
  
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
  
  getIntegrityScore(): number {
    return this.currentSession?.integrityScore || 100;
  }
  
  getEventCount(): { [key: string]: number } {
    if (!this.currentSession) return {};
    
    const counts: { [key: string]: number } = {};
    this.currentSession.events.forEach(event => {
      counts[event.type] = (counts[event.type] || 0) + 1;
    });
    
    return counts;
  }
}