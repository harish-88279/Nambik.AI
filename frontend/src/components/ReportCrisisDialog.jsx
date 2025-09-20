import React, { useState } from 'react';
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

const ReportCrisisDialog = ({ open, handleClose }) => {
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(5);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.post('/crisis-alerts/self-report', {
        description,
        severity,
      });
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        // Clear form after successful submission
        setDescription('');
        setSeverity(5);
        setTimeout(() => handleClose(), 2000); // Close dialog after 2 seconds
      }
    } catch (error) {
      console.error('Error reporting crisis:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to report crisis.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Report a Crisis</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          If you are in immediate danger, please call emergency services.
        </Alert>
        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}
        <TextField
          autoFocus
          margin="dense"
          label="Describe your situation"
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

export default ReportCrisisDialog;
