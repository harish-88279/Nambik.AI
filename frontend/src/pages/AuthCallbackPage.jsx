import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box } from '@mui/material';
import LoadingSpinner from '../components/LoadingSpinner';

const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const handleLogin = async () => {
      const token = searchParams.get('token');
      if (token) {
        try {
            const user = await login(token);
            // After successful login, navigate to role-specific dashboard.
            if (user && (user.role === 'college_admin' || user.role === 'ngo_admin')) {
              navigate('/admin');
            } else {
              navigate('/');
            }
        } catch (err) {
          // If login fails (e.g., bad token), go back to login page
          console.error(err);
          navigate('/login');
        }
      } else {
        // No token found, something went wrong.
        navigate('/login');
      }
    };

    handleLogin();
  }, [searchParams, login, navigate]);

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <LoadingSpinner message="Finalizing login..." />
    </Box>
  );
};

export default AuthCallbackPage;