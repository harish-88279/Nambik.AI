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
  FormControlLabel,
  Switch,
} from '@mui/material';
import { api } from '../services/api';

const AddForumThreadDialog = ({ open, handleClose, onAddThread }) => {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (open) {
      fetchCategories();
      setTitle('');
      setCategoryId('');
      setIsAnonymous(true);
    }
  }, [open]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/forum/categories');
      if (response.data.success) {
        setCategories(response.data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch forum categories', error);
    }
  };

  const handleSubmit = () => {
    if (!title || !categoryId) {
      // Basic validation
      alert('Please fill in all required fields.');
      return;
    }
    onAddThread({ title, categoryId, isAnonymous });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Add New Forum Thread</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Thread Title"
          type="text"
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <FormControl fullWidth margin="dense" required>
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            label="Category"
          >
            {categories.map(category => (
              <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              name="isAnonymous"
              color="primary"
            />
          }
          label="Post Anonymously"
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">Add Thread</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddForumThreadDialog;
