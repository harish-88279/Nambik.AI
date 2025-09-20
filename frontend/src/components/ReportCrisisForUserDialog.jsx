import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { api } from '../services/api';

const ReportCrisisForUserDialog = ({ open, handleClose }) => {
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(5);
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users'); // Assuming an endpoint to get all users
      if (response.data.success) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.post('/crisis-alerts/report-for-user', {
        userId,
        description,
        severity,
      });
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        // Clear form after successful submission
        setDescription('');
        setSeverity(5);
        setUserId('');
        setTimeout(() => handleClose(), 2000); // Close dialog after 2 seconds
      }
    } catch (error) {
      console.error('Error reporting crisis for user:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to report crisis for user.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Report a Crisis for a User</DialogTitle>
      <DialogContent>
        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}
        <FormControl fullWidth margin="dense">
          <InputLabel>Select User</InputLabel>
          <Select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            label="Select User"
          >
            {users.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.first_name} {user.last_name} ({user.email})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          autoFocus
          margin="dense"
          label="Describe the situation"
          type="text"
          fullWidth
          multiline
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ mb: 2 }}
        />
        <FormControl fullWidth margin="dense">
          <InputLabel>Severity Level (1-10)</InputLabel>
          <Select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            label="Severity Level (1-10)"
          >
            {[...Array(10)].map((_, i) => (
              <MenuItem key={i + 1} value={i + 1}>
                {i + 1}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Submitting...' : 'Report Crisis'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportCrisisForUserDialog;
