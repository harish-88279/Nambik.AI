import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { Box } from '@mui/material';
import LoadingSpinner from '../components/LoadingSpinner';

// Create the context
const AuthContext = createContext(null);

// Create an API client to make requests to your backend
const apiClient = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Create the provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await apiClient.get('/auth/me');
          setUser(response.data.data.user);
        } catch (error) {
          console.error("Invalid token, logging out.", error);
          localStorage.removeItem('authToken');
        }
      }
      setLoading(false);
    };
    initializeAuth();
  }, []);

  // Function to handle login via a token (used by Google callback)
  const login = async (token) => {
    setLoading(true);
    try {
      localStorage.setItem('authToken', token);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await apiClient.get('/auth/me');
      setUser(response.data.data.user);
      return response.data.data.user;
    } catch (error) {
      console.error("Login failed", error);
      // Clear out the bad token
      localStorage.removeItem('authToken');
      delete apiClient.defaults.headers.common['Authorization'];
      throw error; // Re-throw the error so the caller can handle it
    } finally {
      setLoading(false);
    }
  };

  // --- THIS IS THE MISSING FUNCTION ---
  // Function to handle login via email and password
  const loginWithEmail = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token } = response.data.data;
      if (token) {
        // After getting the token, use the main login function
        const userObj = await login(token);
        return userObj;
      }
    } catch (error) {
      console.error("Email login failed", error);
      // Throw the error so the LoginPage can display it
      throw new Error(error.response?.data?.message || 'Invalid credentials');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
    delete apiClient.defaults.headers.common['Authorization'];
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <LoadingSpinner />
      </Box>
    );
  }

  const updateUser = async (updatedData) => {
    try {
      const response = await apiClient.put('/users/profile', updatedData);
      setUser(response.data.data.user); // Assuming the backend returns the updated user object
      return response.data.data.user;
    } catch (error) {
      console.error("Error updating user profile", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithEmail, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to easily access the context
export const useAuth = () => {
  return useContext(AuthContext);
};