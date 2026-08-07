import axios from 'axios';

// In dev, talk to the local Express server directly. In a deployed build the API
// is served from the same origin (Vercel rewrites /api/* to the function), so a
// relative base keeps the app working on any domain without a rebuild.
// VITE_API_BASE_URL overrides both, for a separately hosted backend.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ipo_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only treat a 401 as "your session is bad, go re-authenticate" when it is
    // actually about an existing session. A 401 from login or register is an
    // authentication failure message for the user, NOT a reason to clear local storage
    // and force-reload the page.
    const isAuthUrl = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
    const isAuthFailure = !isAuthUrl && error.response &&
      error.response.status === 401 &&
      (error.config?.url?.includes('/auth/') ||
       /Missing Token|Invalid Token|Session expired|Unauthorized/i.test(error.response.data?.message || ''));
    if (isAuthFailure) {
      localStorage.removeItem('ipo_token');
      localStorage.removeItem('ipo_company_id');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);


// ----------------------------------------------------
// API DISPATCHER
// ----------------------------------------------------
// The backend is the single source of truth. There used to be an automatic
// fallback to a localStorage mock whenever a request failed to connect, but it
// silently forked user identity: a signup during an outage wrote the account to
// localStorage only, the UI reported success, and the next page load — which
// reset the flag to false — asked the real server to log in a user it had never
// seen. The account existed, in the wrong database, and was unreachable from the
// UI because signup then returned 409 while login returned 400.
//
// A connection failure is now surfaced as an error the caller can show, rather
// than being papered over with a parallel store.
// Mutations that can move the IPO readiness score. After one succeeds we fire a
// window event so the sidebar score re-fetches immediately instead of waiting for
// its 30s poll — the score is meant to tick up on every single save, upload, or
// certification, not once a whole section is finished. Matched against the request
// URL so no individual page has to remember to announce its own saves.
const SCORE_AFFECTING = [
  /^\/intake\//,          // a single field save
  /^\/documents\//,       // upload, confirm, delete, retry-ocr
  /^\/drafts\//,          // generate / certify a chapter
  /^\/comments\//,        // comment add, edit, delete, resolve
  /^\/companies\//,       // company settings and ipo-readiness status
  /ipo-readiness\/item-status$/  // reviewer milestone sign-off
];

const notifyReadinessChanged = (method, url) => {
  if (method.toLowerCase() === 'get') return;
  if (!SCORE_AFFECTING.some((re) => re.test(url))) return;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('ipo-readiness-changed'));
};

const callApi = async (method, url, data = null, config = {}) => {
  const opts = { method, url, ...config };
  if (data !== null && data !== undefined && method.toLowerCase() !== 'delete') {
    opts.data = data;
  }
  const res = await api(opts);
  notifyReadinessChanged(method, url);
  return res;
};

export const login = (email, password) => callApi('post', '/auth/login', { email, password });
export const register = (payload) => callApi('post', '/auth/register', payload);
export const getMe = () => callApi('get', '/auth/me');
export const getCompanies = () => callApi('get', '/companies');
export const getCompany = (id) => callApi('get', `/companies/${id}`);
export const getCompanyStatus = (id) => callApi('get', `/companies/${id}/status`);
export const getIntake = (companyId) => callApi('get', `/intake/${companyId}`);
export const getIntakeStep = (companyId, stepKey) => callApi('get', `/intake/${companyId}/${stepKey}`);
export const saveIntakeStep = (companyId, stepKey, data) => callApi('put', `/intake/${companyId}/${stepKey}`, data);
export const getDocuments = (companyId) => callApi('get', `/documents/${companyId}`);

// Values OCR pulled out of uploaded documents, mapped onto intake fields.
export const getPrefillSuggestions = (companyId) => callApi('get', `/intake/${companyId}/prefill/suggestions`);
// Blanks-only by default; pass overwrite to also replace conflicting answers.
export const applyPrefill = (companyId, { fields, overwrite } = {}) =>
  callApi('post', `/intake/${companyId}/prefill/apply`, { fields, overwrite });

export const uploadDocument = (companyId, file, docType) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);
  return callApi('post', `/documents/${companyId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const confirmDocument = (id, data) => callApi('put', `/documents/${id}/confirm`, data);
// Re-runs Gemini extraction on an already-uploaded file. Recovers documents whose
// OCR failed, and those left stuck on "processing" by an interrupted run.
export const retryDocumentOcr = (id) => callApi('post', `/documents/${id}/retry-ocr`);
export const deleteDocument = (id) => callApi('delete', `/documents/${id}`);
export const getDrafts = (companyId) => callApi('get', `/drafts/${companyId}`);

export const generateDrafts = (companyId, sectionKey) => {
  const url = sectionKey ? `/drafts/${companyId}/generate?section=${sectionKey}` : `/drafts/${companyId}/generate`;
  return callApi('post', url);
};

export const updateDraftStatus = (companyId, sectionKey, statusData) =>
  callApi('put', `/drafts/${companyId}/${sectionKey}/status`, statusData);

export const updateDraftContent = (companyId, sectionKey, blocks) =>
  callApi('put', `/drafts/${companyId}/${sectionKey}/content`, { blocks });

export const getGapReport = (companyId) => callApi('get', `/drafts/${companyId}/gap-report`);
export const getComments = (sectionId) => callApi('get', `/comments/${sectionId}`);
export const addComment = (sectionId, content, type, blockId = null, parentId = null) => 
  callApi('post', `/comments/${sectionId}`, { content, type, block_id: blockId, parent_id: parentId });

export const editComment = (commentId, content) => callApi('put', `/comments/${commentId}`, { content });
export const deleteComment = (commentId) => callApi('delete', `/comments/${commentId}`);

export const resolveComment = (commentId) => callApi('put', `/comments/${commentId}/resolve`);

// Exports are generated server-side (docx via the `docx` package, PDF via pdfkit)
// so the file the reviewer downloads is the same one the backend certified.
export const downloadDocx = (companyId) =>
  api.get(`/export/${companyId}/docx`, { responseType: 'blob' });

export const downloadPdf = (companyId) =>
  api.get(`/export/${companyId}/pdf`, { responseType: 'blob' });

export const getNotifications = () => callApi('get', '/notifications');
export const markNotificationRead = (id) => callApi('put', `/notifications/${id}/read`);
export const markAllNotificationsRead = () => callApi('put', '/notifications/mark-all-read');
export const createNotification = (data) => callApi('post', '/notifications', data);

export const getSebiNotices = () => callApi('get', '/sebi-notices');
export const refreshSebiNotices = () => callApi('post', '/sebi-notices/refresh');

export const chatbotQuery = (question, history = []) => callApi('post', '/chatbot/query', { question, history });

export const getAuditLogs = (companyId, page = 1, limit = 10, search = '') => {
  const queryParams = new URLSearchParams();
  if (companyId) queryParams.append('companyId', companyId);
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  if (search) queryParams.append('search', search);
  return callApi('get', `/audit-logs?${queryParams.toString()}`);
};

export const getIpoReadiness = (companyId) => callApi('get', `/companies/${companyId}/ipo-readiness`);

export const getMerchantBankers = (query = '') => callApi('get', `/merchant-bankers${query ? `?q=${encodeURIComponent(query)}` : ''}`);
export const createInvitation = (data) => callApi('post', '/invitations', data);
export const getInvitations = () => callApi('get', '/invitations');
export const updateInvitationStatus = (id, status) => callApi('put', `/invitations/${id}/status`, { status });
export const acceptInvitation = (id) => callApi('put', `/invitations/${id}/accept`);
export const declineInvitation = (id) => callApi('put', `/invitations/${id}/decline`);
export const revokeInvitation = (id) => callApi('put', `/invitations/${id}/revoke`);
export const resendInvitation = (id) => callApi('post', `/invitations/${id}/resend`);
export const verifyDocument = (id, status, remarks) => callApi('put', `/documents/${id}/verify`, { status, remarks });
export const updateIpoReadinessItem = (companyId, itemKey, status, remarks) => callApi('put', `/companies/${companyId}/ipo-readiness/item-status`, { itemKey, status, remarks });

export default api;
