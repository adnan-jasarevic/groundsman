import { Routes } from '@angular/router';
import { DepthChart } from './depth-chart/depth-chart';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'depth-chart' },
  { path: 'depth-chart', component: DepthChart, title: 'Depth chart · Groundsman' },
  { path: '**', redirectTo: 'depth-chart' },
];
