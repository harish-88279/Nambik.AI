import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Snackbar, Alert } from '@mui/material';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ChatPage from './pages/ChatPage';
import AppointmentsPage from './pages/AppointmentsPage';
import ResourcesPage from './pages/ResourcesPage';
import ForumPage from './pages/ForumPage';
import SurveysPage from './pages/SurveysPage';
// Admin pages are rendered inside the Dashboard to keep admin layout consistent
import PeerChatPage from './pages/PeerChatPage';
import StudentPeerChatPage from './pages/StudentPeerChatPage';
import ProfilePage from './pages/ProfilePage';
import LoadingSpinner from './components/LoadingSpinner';
import { io } from 'socket.io-client';

// --- CHANGE 1: Import the new AuthCallbackPage ---
import AuthCallbackPage from './pages/AuthCallbackPage';
import AdminLayout from './pages/Admin/AdminLayout';

function App() {
  const { user, loading } = useAuth();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');

  useEffect(() => {
    if (user && (user.role === 'college_admin' || user.role === 'ngo_admin')) {
      const socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000');

      socket.on('newCrisisAlert', (alert) => {
        setSnackbarMessage(`New Crisis Alert: ${alert.description} (Severity: ${alert.severity})`);
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <LoadingSpinner />
      </Box>
    );
  }

  // Routes for unauthenticated users
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* --- CHANGE 2: Use AuthCallbackPage to handle the token --- */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Routes for authenticated users
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/peer-chat" element={<PeerChatPage />} />
        <Route path="/student-peer-chat" element={<StudentPeerChatPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/forum" element={<ForumPage />} />
        <Route path="/surveys" element={<SurveysPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        
        {/* Admin routes */}
        {['college_admin', 'ngo_admin'].includes(user.role) && (
          <>
            {/* Render Dashboard for all /admin routes so the left-side admin nav is always available */}
            <Route path="/admin/*" element={<AdminLayout />} />
          </>
        )}
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Layout>
  );
}

export default App;