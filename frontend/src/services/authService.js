import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/admin/login', {
      email,
      password,
    });
    
    if (response.data.success) {
      return response.data;
    }
    throw new Error(response.data.message || 'Login failed');
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    
    if (response.data.success) {
      return response.data.user;
    }
    throw new Error(response.data.message || 'Failed to get user data');
  },

  async refreshToken() {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }

    const response = await api.post('/auth/refresh', {
      token,
    });
    
    if (response.data.success) {
      return response.data.token;
    }
    throw new Error(response.data.message || 'Token refresh failed');
  },

  logout() {
    localStorage.removeItem('token');
  },

  import { api } from './api';

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/admin/login', {
      email,
      password,
    });
    
    if (response.data.success) {
      return response.data;
    }
    throw new Error(response.data.message || 'Login failed');
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    
    if (response.data.success) {
      return response.data.user;
    }
    throw new Error(response.data.message || 'Failed to get user data');
  },

  async refreshToken() {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }

    const response = await api.post('/auth/refresh', {
      token,
    });
    
    if (response.data.success) {
      return response.data.token;
    }
    throw new Error(response.data.message || 'Token refresh failed');
  },

  logout() {
    localStorage.removeItem('token');
  },

  async updateUserProfile(userData) {
    const response = await api.put('/users/profile', userData);
    
    if (response.data.success) {
      return response.data.data.user;
    }
    throw new Error(response.data.message || 'Failed to update profile');
  },
};
};
