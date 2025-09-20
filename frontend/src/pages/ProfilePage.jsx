import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Avatar,
  Divider,
  Alert,
  MenuItem,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Language as LanguageIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
// api import removed - not used in this component
import { INDIAN_LANGUAGES } from '../constants/indianLanguages';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    preferredLanguage: user?.preferredLanguage || 'en',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [languages, setLanguages] = useState([]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    // Use fixed 22 Indian languages list as requested
    setLanguages(INDIAN_LANGUAGES);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateUser(formData);
      setEditing(false);
      setMessage('Profile updated successfully!');
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Error updating profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
      preferredLanguage: user?.preferredLanguage || 'en',
    });
    setEditing(false);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>

      {message && (
        <Alert severity={message.includes('Error') ? 'error' : 'success'} sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar
                src={user?.profilePictureUrl}
                sx={{
                  width: 120,
                  height: 120,
                  mx: 'auto',
                  mb: 2,
                  fontSize: '3rem',
                }}
              >
                {user?.role === 'college_admin' || user?.role === 'ngo_admin' ? `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}` : user?.lastName?.[0] || ''}
              </Avatar>
              <Typography variant="h5" gutterBottom>
                {user?.role === 'college_admin' || user?.role === 'ngo_admin' ? `${user?.firstName} ${user?.lastName}` : user?.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {user?.role?.replace('_', ' ').toUpperCase()}
              </Typography>
              {user?.institutionName && (
                <Typography variant="body2" color="text.secondary">
                  {user.institutionName}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Personal Information
                </Typography>
                <Button
                  variant={editing ? 'outlined' : 'contained'}
                  onClick={editing ? handleCancel : () => setEditing(true)}
                >
                  {editing ? 'Cancel' : 'Edit Profile'}
                </Button>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    disabled={!editing}
                    InputProps={{
                      startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    disabled={!editing}
                    InputProps={{
                      startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={user?.email || ''}
                    disabled
                    InputProps={{
                      startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={!editing}
                    InputProps={{
                      startAdornment: <PhoneIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    fullWidth
                    label="Preferred Language"
                    value={formData.preferredLanguage}
                    onChange={(e) => handleInputChange('preferredLanguage', e.target.value)}
                    disabled={!editing}
                    InputProps={{
                      startAdornment: <LanguageIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  >
                    {languages.length > 0 ? (
                      languages.map((lang) => (
                        <MenuItem key={lang} value={lang}>{lang.toUpperCase()}</MenuItem>
                      ))
                    ) : (
                      <MenuItem value="en">EN</MenuItem>
                    )}
                  </TextField>
                </Grid>
              </Grid>

              {editing && (
                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Account Status
                  </Typography>
                  <Typography variant="body1">
                    {user?.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Verification Status
                  </Typography>
                  <Typography variant="body1">
                    {user?.isVerified ? 'Verified' : 'Unverified'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Member Since
                  </Typography>
                  <Typography variant="body1">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Last Login
                  </Typography>
                  <Typography variant="body1">
                    {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;
