import { Routes } from "@angular/router";
import { DashboardComponent } from "./features/dashboard/dashboard";
import { AnalysisComponent } from "./features/analysis/analysis";

export const routes: Routes = [
    { path: '', component: DashboardComponent },
    { path: 'analysis', component: AnalysisComponent },
    { path: 'analysis/loading/:id', loadComponent: () => import('./features/analysis/pages/loader-page/loader-page.component').then(m => m.AnalysisLoaderPageComponent) },
    { path: 'analysis/:id', component: AnalysisComponent },
    { path: 'report', loadComponent: () => import('./features/report/report-view.component').then(m => m.ReportViewComponent) },
];
