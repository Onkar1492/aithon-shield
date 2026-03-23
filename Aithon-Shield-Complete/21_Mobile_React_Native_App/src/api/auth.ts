import apiClient from './client';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company?: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<User> => {
    const response = await apiClient.post('/auth/login', credentials);
    if (response.data.token) {
      await SecureStore.setItemAsync('authToken', response.data.token);
    }
    return response.data.user;
  },

  register: async (data: RegisterData): Promise<User> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data.user;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
    await SecureStore.deleteItemAsync('authToken');
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response = await apiClient.get('/auth/me');
      return response.data.user;
    } catch {
      return null;
    }
  },
};
