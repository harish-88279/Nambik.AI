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
} from '@mui/material';
import { api } from '../services/api';

const AddResourceDialog = ({ open, onClose, onResourceAdded }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [resourceType, setResourceType] = useState('video');
  const [categoryId, setCategoryId] = useState('');
  const [language, setLanguage] = useState('en');
  const [tags, setTags] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/resources/categories');
      if (response.data.success) {
        setCategories(response.data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  const handleAddResource = async () => {
    const newResource = {
      title,
      description,
      fileUrl,
      resourceType,
      categoryId,
      language,
      tags: tags.split(',').map(tag => tag.trim()),
    };
    try {
      const response = await api.post('/resources', newResource);
      if (response.data.success) {
        onResourceAdded(response.data.resource);
        onClose();
      }
    } catch (error) {
      console.error('Failed to add resource', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add New Resource</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Title"
          type="text"
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Description"
          type="text"
          fullWidth
          multiline
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          margin="dense"
          label="URL"
          type="text"
          fullWidth
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
        />
        <FormControl fullWidth margin="dense">
          <InputLabel>Type</InputLabel>
          <Select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
          >
            <MenuItem value="video">Video</MenuItem>
            <MenuItem value="article">Article</MenuItem>
            <MenuItem value="audio">Audio</MenuItem>
            <MenuItem value="document">Document</MenuItem>
            <MenuItem value="link">Link</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth margin="dense">
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map(category => (
              <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          margin="dense"
          label="Language"
          type="text"
          fullWidth
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Tags (comma-separated)"
          type="text"
          fullWidth
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleAddResource}>Add</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddResourceDialog;
