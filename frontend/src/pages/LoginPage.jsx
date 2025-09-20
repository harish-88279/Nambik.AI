import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Divider,
  Container,
  Paper,
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // --- CHANGE 1: Get the new loginWithEmail function ---
  const { loginWithEmail } = useAuth();
  const navigate = useNavigate();

  // This useEffect is no longer needed here, the AuthCallbackPage handles it.

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // --- CHANGE 2: Call loginWithEmail for the form ---
      const user = await loginWithEmail(email, password);
      if (user && (user.role === 'college_admin' || user.role === 'ngo_admin')) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // --- CHANGE 3: The Google button now just redirects to the backend ---
    window.location.href = 'http://localhost:5000/api/auth/google';
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography component="h1" variant="h4" color="primary" gutterBottom>
              PsyHelp
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Mental Health Support Platform
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sign In
              </Typography>
              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="Email Address"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{ mt: 3, mb: 2 }}
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner size={20} message="" /> : 'Sign In'}
                </Button>
              </Box>

              <Divider sx={{ my: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  OR
                </Typography>
              </Divider>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<GoogleIcon />}
                onClick={handleGoogleLogin}
                sx={{ mb: 2 }}
              >
                Sign in with Google
              </Button>

              <Typography variant="body2" color="text.secondary" align="center">
                For students and other users, please use Google Sign-In
              </Typography>
            </CardContent>
          </Card>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Default Admin Credentials:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Email: admin@gmail.com | Password: a1
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;