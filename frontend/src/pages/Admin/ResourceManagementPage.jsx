import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArticleIcon from '@mui/icons-material/Article';
import LinkIcon from '@mui/icons-material/Link';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ReactPlayer from 'react-player/youtube'; // Optimized for YouTube, can be react-player for broader support

import { api } from '../../services/api';
import { useCallback } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import AddResourceDialog from '../../components/AddResourceDialog';

const ResourceManagementPage = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [filterTags, setFilterTags] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterTags) {
        params.tag = filterTags.split(',').map(tag => tag.trim());
      }
      if (filterLanguage) {
        params.language = filterLanguage;
      }
      const response = await api.get('/resources', { params });
      if (response.data.success) {
        setResources(response.data.resources);
      }
    } catch (err) {
      setError('Failed to load resources.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterTags, filterLanguage]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const onResourceAdded = (newResource) => {
    setResources((prevResources) => [...prevResources, newResource]);
    handleClose();
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleEdit = (resourceId) => {
    console.log('Edit resource:', resourceId);
    // Implement edit logic here
  };

  const handleDelete = async (resourceId) => {
    console.log('Delete resource:', resourceId);
    // Implement delete logic here, e.g., API call to DELETE /resources/:resourceId
    try {
      await api.delete(`/resources/${resourceId}`);
      setResources((prevResources) => prevResources.filter(res => res.id !== resourceId));
    } catch (err) {
      console.error('Failed to delete resource:', err);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading resources..." />;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Resource Management</Typography>
        <Button variant="contained" onClick={handleClickOpen}>
          Add Resource
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          label="Filter by Tags (comma-separated)"
          variant="outlined"
          value={filterTags}
          onChange={(e) => setFilterTags(e.target.value)}
          fullWidth
        />
        <FormControl variant="outlined" sx={{ minWidth: 120 }}>
          <InputLabel>Language</InputLabel>
          <Select
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
            label="Language"
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="es">Spanish</MenuItem>
            <MenuItem value="fr">French</MenuItem>
            {/* Add more languages as needed */}
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={3}>
        {resources.map((resource) => (
          <Grid item xs={12} sm={6} md={4} key={resource.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {resource.resource_type === 'video' && resource.file_url ? (
                <Box sx={{ position: 'relative', paddingTop: '56.25%' }}> {/* 16:9 Aspect Ratio */}
                  <ReactPlayer
                    url={resource.file_url}
                    controls={true}
                    width="100%"
                    height="100%"
                    style={{ position: 'absolute', top: 0, left: 0 }}
                  />
                </Box>
              ) : resource.thumbnail_url ? (
                <CardMedia
                  component="img"
                  height="140"
                  image={resource.thumbnail_url}
                  alt={resource.title}
                />
              ) : (
                <Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }}>
                  {resource.resource_type === 'article' && <ArticleIcon sx={{ fontSize: 60, color: '#ccc' }} />}
                  {resource.resource_type === 'link' && <LinkIcon sx={{ fontSize: 60, color: '#ccc' }} />}
                  {resource.resource_type === 'audio' && <AudioFileIcon sx={{ fontSize: 60, color: '#ccc' }} />}
                  {resource.resource_type === 'document' && <PictureAsPdfIcon sx={{ fontSize: 60, color: '#ccc' }} />}
                  {resource.resource_type === 'video' && <PlayArrowIcon sx={{ fontSize: 60, color: '#ccc' }} />}
                </Box>
              )}
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h5" component="div">
                  {resource.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {resource.description?.substring(0, 100)}...
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={resource.resource_type}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  {resource.category_name && (
                    <Chip
                      label={resource.category_name}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                  )}
                  {resource.language && (
                    <Chip
                      label={`Lang: ${resource.language}`}
                      size="small"
                    />
                  )}
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => console.log('View', resource.id)}>View</Button>
                <IconButton size="small" onClick={() => handleEdit(resource.id)} color="primary">
                  <EditIcon />
                </IconButton>
                <IconButton size="small" onClick={() => handleDelete(resource.id)} color="error">
                  <DeleteIcon />
                </IconButton>
                <Box sx={{ flexGrow: 1 }} />
                <Chip label={resource.is_published ? 'Published' : 'Draft'} color={resource.is_published ? 'success' : 'default'} size="small" />
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <AddResourceDialog open={open} handleClose={handleClose} onAddResource={onResourceAdded} />
    </Box>
  );
};

export default ResourceManagementPage;
