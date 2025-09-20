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

const FeedbackDialog = ({ open, handleClose, appointment, senderUser, receiverUser }) => {
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.post('/feedback', {
        senderId: senderUser.id,
        receiverId: receiverUser.id,
        appointmentId: appointment.id,
        rating,
        comments,
      });
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        // Clear form after successful submission
        setRating(5);
        setComments('');
        setTimeout(() => handleClose(), 2000); // Close dialog after 2 seconds
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to submit feedback.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Give Feedback for {receiverUser?.first_name} {receiverUser?.last_name}</DialogTitle>
      <DialogContent>
        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}
        <FormControl fullWidth margin="dense">
          <InputLabel>Rating (1-5)</InputLabel>
          <Select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            label="Rating (1-5)"
          >
            {[1, 2, 3, 4, 5].map((num) => (
              <MenuItem key={num} value={num}>
                {num}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          margin="dense"
          label="Comments"
          type="text"
          fullWidth
          multiline
          rows={4}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FeedbackDialog;
