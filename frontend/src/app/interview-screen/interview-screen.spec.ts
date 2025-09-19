import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewScreen } from './interview-screen';

describe('InterviewScreen', () => {
  let component: InterviewScreen;
  let fixture: ComponentFixture<InterviewScreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewScreen]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterviewScreen);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
