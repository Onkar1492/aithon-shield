import apiClient from './client';
import { MvpScan, WebScan, MobileScan, Finding, DashboardStats } from '../types';

export const scansApi = {
  // Dashboard
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get('/dashboard/stats');
    return response.data;
  },

  // MVP Scans
  getMvpScans: async (): Promise<MvpScan[]> => {
    const response = await apiClient.get('/mvp-scans');
    return response.data;
  },

  getMvpScan: async (id: number): Promise<MvpScan> => {
    const response = await apiClient.get(`/mvp-scans/${id}`);
    return response.data;
  },

  createMvpScan: async (data: Partial<MvpScan>): Promise<MvpScan> => {
    const response = await apiClient.post('/mvp-scans', data);
    return response.data;
  },

  updateMvpScan: async (id: number, data: Partial<MvpScan>): Promise<MvpScan> => {
    const response = await apiClient.patch(`/mvp-scans/${id}`, data);
    return response.data;
  },

  deleteMvpScan: async (id: number): Promise<void> => {
    await apiClient.delete(`/mvp-scans/${id}`);
  },

  startMvpScan: async (id: number): Promise<void> => {
    await apiClient.post(`/mvp-scans/${id}/scan`);
  },

  applyMvpFixes: async (id: number): Promise<void> => {
    await apiClient.post(`/mvp-scans/${id}/apply-fixes`);
  },

  uploadMvpScan: async (id: number, withFixes: boolean): Promise<void> => {
    await apiClient.post(`/mvp-scans/${id}/upload`, { withFixes });
  },

  // Web Scans
  getWebScans: async (): Promise<WebScan[]> => {
    const response = await apiClient.get('/web-scans');
    return response.data;
  },

  getWebScan: async (id: number): Promise<WebScan> => {
    const response = await apiClient.get(`/web-scans/${id}`);
    return response.data;
  },

  createWebScan: async (data: Partial<WebScan>): Promise<WebScan> => {
    const response = await apiClient.post('/web-scans', data);
    return response.data;
  },

  updateWebScan: async (id: number, data: Partial<WebScan>): Promise<WebScan> => {
    const response = await apiClient.patch(`/web-scans/${id}`, data);
    return response.data;
  },

  deleteWebScan: async (id: number): Promise<void> => {
    await apiClient.delete(`/web-scans/${id}`);
  },

  startWebScan: async (id: number): Promise<void> => {
    await apiClient.post(`/web-scans/${id}/scan`);
  },

  applyWebFixes: async (id: number): Promise<void> => {
    await apiClient.post(`/web-scans/${id}/apply-fixes`);
  },

  uploadWebScan: async (id: number, withFixes: boolean): Promise<void> => {
    await apiClient.post(`/web-scans/${id}/upload`, { withFixes });
  },

  // Mobile Scans
  getMobileScans: async (): Promise<MobileScan[]> => {
    const response = await apiClient.get('/mobile-scans');
    return response.data;
  },

  getMobileScan: async (id: number): Promise<MobileScan> => {
    const response = await apiClient.get(`/mobile-scans/${id}`);
    return response.data;
  },

  createMobileScan: async (data: Partial<MobileScan>): Promise<MobileScan> => {
    const response = await apiClient.post('/mobile-scans', data);
    return response.data;
  },

  updateMobileScan: async (id: number, data: Partial<MobileScan>): Promise<MobileScan> => {
    const response = await apiClient.patch(`/mobile-scans/${id}`, data);
    return response.data;
  },

  deleteMobileScan: async (id: number): Promise<void> => {
    await apiClient.delete(`/mobile-scans/${id}`);
  },

  startMobileScan: async (id: number): Promise<void> => {
    await apiClient.post(`/mobile-scans/${id}/scan`);
  },

  applyMobileFixes: async (id: number): Promise<void> => {
    await apiClient.post(`/mobile-scans/${id}/apply-fixes`);
  },

  uploadMobileScan: async (id: number, withFixes: boolean): Promise<void> => {
    await apiClient.post(`/mobile-scans/${id}/upload`, { withFixes });
  },

  // Findings
  getFindings: async (scanType?: string, scanId?: number): Promise<Finding[]> => {
    const params = new URLSearchParams();
    if (scanType) params.append('scanType', scanType);
    if (scanId) params.append('scanId', scanId.toString());
    const response = await apiClient.get(`/findings?${params.toString()}`);
    return response.data;
  },

  getFinding: async (id: number): Promise<Finding> => {
    const response = await apiClient.get(`/findings/${id}`);
    return response.data;
  },

  updateFinding: async (id: number, data: Partial<Finding>): Promise<Finding> => {
    const response = await apiClient.patch(`/findings/${id}`, data);
    return response.data;
  },
};
