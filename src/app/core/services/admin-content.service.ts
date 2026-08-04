import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Article } from '../../models/article.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/** Request body for the RAG draft generator (Phase 5). */
export interface GenerateDraftRequest {
  topic: string;
  sources: string[];
  category?: string;
  guidance?: string;
}

/**
 * Admin-only content operations. The auth interceptor adds the Bearer token
 * automatically; errors surface to the caller so the admin UI can react.
 */
@Injectable({ providedIn: 'root' })
export class AdminContentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/content`;

  /** Generate a DRAFT article from trusted sources via the RAG endpoint. */
  generateDraft(body: GenerateDraftRequest): Observable<Article> {
    return this.http
      .post<ApiResponse<Article>>(`${this.base}/rag/drafts`, body)
      .pipe(map((res) => res.data));
  }

  /** Create a blank draft to write by hand (no RAG cost). Returns the new article. */
  create(body: {
    slug: string;
    title: string;
    excerpt: string;
    bodyMd: string;
    author: string;
    category?: string;
  }): Observable<Article> {
    return this.http
      .post<ApiResponse<Article>>(`${this.base}/articles`, body)
      .pipe(map((res) => res.data));
  }

  /** Every article incl. drafts, most recently updated first. */
  listAll(): Observable<Article[]> {
    return this.http
      .get<ApiResponse<Article[]>>(`${this.base}/articles/admin/all`)
      .pipe(map((res) => res.data ?? []));
  }

  getOne(id: string): Observable<Article> {
    return this.http
      .get<ApiResponse<Article>>(`${this.base}/articles/admin/${id}`)
      .pipe(map((res) => res.data));
  }

  update(id: string, patch: Partial<Article>): Observable<Article> {
    return this.http
      .patch<ApiResponse<Article>>(`${this.base}/articles/${id}`, patch)
      .pipe(map((res) => res.data));
  }

  /** Publish + fire the site rebuild hook (server-side). */
  publish(id: string): Observable<Article> {
    return this.http
      .post<ApiResponse<Article>>(`${this.base}/articles/${id}/publish`, {})
      .pipe(map((res) => res.data));
  }
}
