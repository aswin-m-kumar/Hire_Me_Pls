/**
 * Resumes API
 *
 * Provides methods for managing resumes, triggering AI analysis,
 * generating rewrites, and computing version diffs.
 */
import { apiClient } from "./client";

export const resumesApi = {
  /* ───────────────────────────── CRUD ───────────────────────────── */

  /** Fetch every resume belonging to the authenticated user. */
  list: () => apiClient.get("/resumes").then((r) => r.data),

  /** Fetch a single resume by its ID. */
  get: (id) => apiClient.get(`/resumes/${id}`).then((r) => r.data),

  /** Fetch a specific version snapshot of a resume. */
  getVersion: (id, versionId) =>
    apiClient
      .get(`/resumes/${id}/versions/${versionId}`)
      .then((r) => r.data),

  /**
   * Upload a new resume file.
   * @param {File}   file  - The resume file (PDF, DOCX, etc.).
   * @param {string} [title] - Optional human-readable title.
   */
  upload: (file, title) => {
    const fd = new FormData();
    fd.append("file", file);
    if (title) fd.append("title", title);

    return apiClient
      .post("/resumes", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  /** Permanently delete a resume and all associated data. */
  remove: (id) => apiClient.delete(`/resumes/${id}`).then((r) => r.data),

  /* ──────────────────────────── Analysis ─────────────────────────── */

  /**
   * Trigger an AI analysis for the given resume.
   * @param {string} id          - Resume ID.
   * @param {Object} [body={}]   - Optional analysis parameters.
   */
  analyze: (id, body = {}) =>
    apiClient.post(`/resumes/${id}/analyze`, body).then((r) => r.data),

  /** Retrieve all past analyses for a resume. */
  analyses: (id) =>
    apiClient.get(`/resumes/${id}/analyses`).then((r) => r.data),

  /** Retrieve the analysis tied to a specific version. */
  analysisForVersion: (id, versionId) =>
    apiClient
      .get(`/resumes/${id}/versions/${versionId}/analysis`)
      .then((r) => r.data),

  /* ────────────────────────── Rewrite & Diff ─────────────────────── */

  /**
   * Request an AI-powered rewrite of the resume.
   * @param {string} id   - Resume ID.
   * @param {Object} body - Rewrite instructions / preferences.
   */
  rewrite: (id, body) =>
    apiClient.post(`/resumes/${id}/rewrite`, body).then((r) => r.data),

  /**
   * Compute a diff between two versions.
   * @param {string} id            - Resume ID.
   * @param {string} from          - Source version ID.
   * @param {string} to            - Target version ID.
   * @param {string} [mode="words"] - Diff granularity ("words" | "lines").
   */
  diff: (id, from, to, mode = "words") =>
    apiClient
      .get(`/resumes/${id}/diff`, { params: { from, to, mode } })
      .then((r) => r.data),
};
