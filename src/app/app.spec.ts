import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { FICTIONAL_SAVE } from '../testing/fictional-save';
import { SAVE } from './state/plan-store';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: SAVE, useValue: FICTIONAL_SAVE }],
    }).compileComponents();
  });

  it('shows the product name and the save in the rail', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.wordmark')?.textContent).toContain('Groundsman');
    expect(el.querySelector('.save')?.textContent).toContain('Harrowgate Town');
  });
});
