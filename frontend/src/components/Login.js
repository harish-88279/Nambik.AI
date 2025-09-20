// In your main server file (e.g., backend/src/server.ts)

import express from 'express';
import session from 'express-session';
import passport from './config/passport'; // Import the passport config
import authRoutes from './routes/auth';   // Import the auth routes
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// 1. Configure session management
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'a_very_secret_key',
    resave: false,
    saveUninitialized: false,
  })
);

// 2. Initialize Passport and session
app.use(passport.initialize());
app.use(passport.session());

// 3. Use the authentication routes
app.use('/api/auth', authRoutes);

// ... your other routes and middleware

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
import React from 'react';
import { Button } from '@mui/material';

const Login = () => {
  const handleGoogleLogin = () => {
    // This redirects the user to the backend's Google authentication route.
    // The backend will handle the OAuth flow with Google and then redirect
    // the user back to the frontend upon success.
    window.location.href = 'http://localhost:5000/api/auth/google';
  };

  return (
    <div>
      <h2>Login</h2>
      <Button variant="contained" onClick={handleGoogleLogin}>
        Sign in with Google
      </Button>
    </div>
  );
};

export default Login;
