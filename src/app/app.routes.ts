import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { DepthChart } from './depth-chart/depth-chart';
import { ImportPage } from './import/import-page';
import { SavesPage } from './saves/saves-page';
import { SquadPage } from './squad/squad-page';
import { TimelinePage } from './timeline/timeline-page';
import { PlanStore } from './state/plan-store';

const hasSquad = () => inject(PlanStore).hasSave() || inject(Router).createUrlTree(['/import']);

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => (inject(PlanStore).hasSave() ? 'depth-chart' : 'import'),
  },
  {
    path: 'depth-chart',
    component: DepthChart,
    title: 'Depth chart · Groundsman',
    canActivate: [hasSquad],
  },
  {
    path: 'squad',
    component: SquadPage,
    title: 'Squad · Groundsman',
    canActivate: [hasSquad],
  },
  {
    path: 'season-timeline',
    component: TimelinePage,
    title: 'Season timeline · Groundsman',
    canActivate: [hasSquad],
  },
  { path: 'import', component: ImportPage, title: 'Import from FM · Groundsman' },
  { path: 'saves', component: SavesPage, title: 'Saves & backup · Groundsman' },
  { path: '**', redirectTo: '' },
];
