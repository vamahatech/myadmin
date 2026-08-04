import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { DashboardMetrics } from '../../models/verdiq/dashboard.model';
import { ProductCreate, ProductDetail, ProductPage, ProductQuery, ProductUpdate } from '../../models/verdiq/product.model';
import { GapsReport } from '../../models/verdiq/coverage.model';
import { VerdictLevel, VerdictPage } from '../../models/verdiq/verdict.model';
import { Additive, AdditiveList, SeedResult } from '../../models/verdiq/additive.model';
import { DoubleStandardInput, DoubleStandardRow } from '../../models/verdiq/double-standard.model';
import { Analytics } from '../../models/verdiq/analytics.model';
import { SubmissionList } from '../../models/verdiq/submission.model';
import { UsersReport } from '../../models/verdiq/admin-user.model';
import { AlternativeInput, AlternativeRow } from '../../models/verdiq/alternative.model';
import { IngestList, IngestStatus } from '../../models/verdiq/ingest.model';
import { ProductReportList } from '../../models/verdiq/report.model';
import { AppFeedbackList } from '../../models/verdiq/feedback.model';

// Typed client for the backend's /admin/* routes. All admin data flows through
// here — no component talks to HttpClient directly.
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private http = inject(HttpClient);
  private base = environment.verdiq.apiBaseUrl;

  getMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.base}/admin/metrics`);
  }

  getProducts(query: ProductQuery = {}): Observable<ProductPage> {
    let params = new HttpParams();
    if (query.q) params = params.set('q', query.q);
    if (query.field) params = params.set('field', query.field);
    if (query.category) params = params.set('category', query.category);
    if (query.incomplete) params = params.set('incomplete', 'true');
    if (query.page) params = params.set('page', String(query.page));
    if (query.pageSize) params = params.set('pageSize', String(query.pageSize));
    return this.http.get<ProductPage>(`${this.base}/admin/products`, { params });
  }

  createProduct(body: ProductCreate): Observable<ProductDetail> {
    return this.http.post<ProductDetail>(`${this.base}/admin/products`, body);
  }

  deleteProduct(id: string): Observable<{ deleted: string }> {
    return this.http.delete<{ deleted: string }>(`${this.base}/admin/products/${id}`);
  }

  getProduct(id: string): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`${this.base}/admin/products/${id}`);
  }

  updateProduct(id: string, body: ProductUpdate): Observable<ProductDetail> {
    return this.http.patch<ProductDetail>(`${this.base}/admin/products/${id}`, body);
  }

  getGaps(): Observable<GapsReport> {
    return this.http.get<GapsReport>(`${this.base}/admin/gaps`);
  }

  getVerdicts(page = 1, pageSize = 25): Observable<VerdictPage> {
    const params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    return this.http.get<VerdictPage>(`${this.base}/admin/verdicts`, { params });
  }

  overrideVerdict(body: {
    barcode: string;
    ageBand: string;
    verdict: VerdictLevel;
    reason: string;
    citation: string;
  }): Observable<unknown> {
    return this.http.post(`${this.base}/admin/verdicts/override`, body);
  }

  recomputeVerdict(barcode: string, ageBand: string): Observable<unknown> {
    return this.http.post(`${this.base}/admin/verdicts/recompute`, { barcode, ageBand });
  }

  // ── Additives (INS) ──────────────────────────────────────────────
  getAdditives(): Observable<AdditiveList> {
    return this.http.get<AdditiveList>(`${this.base}/admin/additives`);
  }

  upsertAdditive(a: Additive): Observable<Additive> {
    return this.http.post<Additive>(`${this.base}/admin/additives`, a);
  }

  deleteAdditive(ins: string): Observable<{ deleted: string }> {
    return this.http.delete<{ deleted: string }>(`${this.base}/admin/additives/${encodeURIComponent(ins)}`);
  }

  seedAdditives(): Observable<SeedResult> {
    return this.http.post<SeedResult>(`${this.base}/admin/additives/seed`, {});
  }

  // ── Double standards ─────────────────────────────────────────────
  getDoubleStandards(): Observable<{ rows: DoubleStandardRow[] }> {
    return this.http.get<{ rows: DoubleStandardRow[] }>(`${this.base}/admin/double-standards`);
  }

  upsertDoubleStandard(d: DoubleStandardInput): Observable<{ barcode: string }> {
    return this.http.post<{ barcode: string }>(`${this.base}/admin/double-standards`, d);
  }

  verifyDoubleStandard(barcode: string, verified: boolean): Observable<unknown> {
    return this.http.patch(
      `${this.base}/admin/double-standards/${encodeURIComponent(barcode)}/verify`,
      { verified },
    );
  }

  deleteDoubleStandard(barcode: string): Observable<{ deleted: string }> {
    return this.http.delete<{ deleted: string }>(
      `${this.base}/admin/double-standards/${encodeURIComponent(barcode)}`,
    );
  }

  // ── Analytics ────────────────────────────────────────────────────
  getAnalytics(days = 30): Observable<Analytics> {
    const params = new HttpParams().set('days', String(days));
    return this.http.get<Analytics>(`${this.base}/admin/analytics`, { params });
  }

  // ── Submissions ──────────────────────────────────────────────────
  getSubmissions(status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending'): Observable<SubmissionList> {
    const params = new HttpParams().set('status', status);
    return this.http.get<SubmissionList>(`${this.base}/admin/submissions`, { params });
  }

  approveSubmission(id: string, note?: string): Observable<unknown> {
    return this.http.post(`${this.base}/admin/submissions/${id}/approve`, { note });
  }

  rejectSubmission(id: string, note?: string): Observable<unknown> {
    return this.http.post(`${this.base}/admin/submissions/${id}/reject`, { note });
  }

  // ── Product reports ────────────────────────────────────────────────
  getReports(status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending'): Observable<ProductReportList> {
    const params = new HttpParams().set('status', status);
    return this.http.get<ProductReportList>(`${this.base}/admin/reports`, { params });
  }

  approveReport(id: string, note?: string): Observable<unknown> {
    return this.http.post(`${this.base}/admin/reports/${id}/approve`, { note });
  }

  rejectReport(id: string, note?: string): Observable<unknown> {
    return this.http.post(`${this.base}/admin/reports/${id}/reject`, { note });
  }

  // ── App feedback ───────────────────────────────────────────────────
  getFeedback(status: 'new' | 'read' | 'all' = 'all'): Observable<AppFeedbackList> {
    const params = new HttpParams().set('status', status);
    return this.http.get<AppFeedbackList>(`${this.base}/admin/feedback`, { params });
  }

  markFeedbackRead(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/admin/feedback/${id}/read`, {});
  }

  // ── Users & testers ──────────────────────────────────────────────
  getUsers(): Observable<UsersReport> {
    return this.http.get<UsersReport>(`${this.base}/admin/users`);
  }

  // Admin creates an app user (or admin, if isAdmin is true); backend
  // generates + emails a password.
  createUser(
    email: string,
    isAdmin = false,
  ): Observable<{ id: string; email: string; isAdmin: boolean; emailed: boolean }> {
    return this.http.post<{ id: string; email: string; isAdmin: boolean; emailed: boolean }>(
      `${this.base}/admin/users`,
      { email, isAdmin },
    );
  }

  // Promote/demote an existing user's admin status.
  setUserAdmin(id: string, isAdmin: boolean): Observable<{ id: string; email: string; isAdmin: boolean }> {
    return this.http.patch<{ id: string; email: string; isAdmin: boolean }>(
      `${this.base}/admin/users/${id}`,
      { isAdmin },
    );
  }

  deleteUser(id: string): Observable<{ deleted: string }> {
    return this.http.delete<{ deleted: string }>(`${this.base}/admin/users/${id}`);
  }

  // ── Alternatives (Screen 3 curation: homemade + cleaner packaged) ────────
  getAlternatives(barcode?: string): Observable<{ rows: AlternativeRow[] }> {
    let params = new HttpParams();
    if (barcode) params = params.set('barcode', barcode);
    return this.http.get<{ rows: AlternativeRow[] }>(`${this.base}/admin/alternatives`, { params });
  }

  addAlternative(a: AlternativeInput): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/admin/alternatives`, a);
  }

  deleteAlternative(id: string): Observable<{ deleted: string }> {
    return this.http.delete<{ deleted: string }>(`${this.base}/admin/alternatives/${id}`);
  }

  // ── Ingest review queue (scraped e-commerce leads → products) ────────────
  getIngest(status: IngestStatus | 'all' = 'pending_review'): Observable<IngestList> {
    const params = new HttpParams().set('status', status);
    return this.http.get<IngestList>(`${this.base}/admin/ingest`, { params });
  }

  // Approve copies the staged row into products. `barcode` lets the admin attach
  // the real EAN at approval time (scraped rows usually lack one).
  approveIngest(
    id: string,
    body: { barcode?: string; note?: string } = {},
  ): Observable<{ id: string; status: string; barcode: string | null }> {
    return this.http.post<{ id: string; status: string; barcode: string | null }>(
      `${this.base}/admin/ingest/${id}/approve`,
      body,
    );
  }

  rejectIngest(id: string, note?: string): Observable<unknown> {
    return this.http.post(`${this.base}/admin/ingest/${id}/reject`, { note });
  }
}
