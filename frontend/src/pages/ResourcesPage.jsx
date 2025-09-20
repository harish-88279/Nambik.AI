import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  PlayArrow as PlayIcon,
  Article as ArticleIcon,
  VideoLibrary as VideoIcon,
  Headphones as AudioIcon,
  Description as DocumentIcon,
  Link as LinkIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import LoadingSpinner from '../components/LoadingSpinner';
import AddResourceDialog from '../components/AddResourceDialog';
import { useAuth } from '../context/AuthContext';
import ReactPlayer from 'react-player/youtube';
import { api } from '../services/api';
import { INDIAN_LANGUAGES } from '../constants/indianLanguages';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`resources-tabpanel-${index}`}
      aria-labelledby={`resources-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ResourcesPage = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [filterTags, setFilterTags] = useState(''); // New state for tags filter
  const [filterLanguage, setFilterLanguage] = useState(''); // New state for language filter
  const [tabValue, setTabValue] = useState(0);
  const [addResourceOpen, setAddResourceOpen] = useState(false);
  const [languages, setLanguages] = useState([]); // Available languages for dropdown

  const loadResources = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        categoryId: selectedCategory,
        resourceType: selectedType,
        q: searchTerm,
      };
      if (filterTags) {
        params.tag = filterTags.split(',').map(tag => tag.trim());
      }
      if (filterLanguage) {
        params.language = filterLanguage;
      }
      const resourcesRes = await api.get('/resources', { params });
      setResources(resourcesRes.data.resources);
    } catch (error) {
      console.error('Error loading resources:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedType, searchTerm, filterTags, filterLanguage]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const categoriesRes = await api.get('/resources/categories');
        setCategories(categoriesRes.data.categories);
        setLanguages(INDIAN_LANGUAGES);
        await loadResources();
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [loadResources]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadResources();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [loadResources]); // loadResources is stable via useCallback

  const handleAddResource = async (newResource) => {
    try {
      await api.post('/resources', newResource);
      loadResources();
    } catch (error) {
      console.error('Error adding resource:', error);
    }
  };

  const getResourceIcon = (type) => {
    switch (type) {
      case 'video': return <VideoIcon />;
      case 'audio': return <AudioIcon />;
      case 'document': return <DocumentIcon />;
      case 'link': return <LinkIcon />;
      default: return <ArticleIcon />;
    }
  };

  const getResourceColor = (type) => {
    switch (type) {
      case 'video': return 'primary';
      case 'audio': return 'secondary';
      case 'document': return 'info';
      case 'link': return 'success';
      default: return 'default';
    }
  };

  // If resources are empty (API not used), provide demo resources
  const demoResources = [
    { id: 'r1', title: 'Managing Exam Stress', description: 'Short video on breathing and focus', resource_type: 'video', file_url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U', is_featured: true },
    { id: 'r2', title: 'Sleep Hygiene Tips', description: 'Article with practical sleep tips', resource_type: 'document', file_url: '', is_featured: false },
    { id: 'r3', title: 'Mindfulness Audio', description: '10-minute guided mindfulness', resource_type: 'audio', file_url: '', is_featured: false },
  ];
  const effectiveResources = resources.length > 0 ? resources : demoResources;

  const featuredResources = effectiveResources.filter(resource => resource.is_featured);
  const allResources = effectiveResources;
  const videoResources = effectiveResources.filter(r => r.resource_type === 'video');

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) {
    return <LoadingSpinner message="Loading resources..." />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Mental Health Resources
        </Typography>
        {user && ['college_admin', 'ngo_admin'].includes(user.role) && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddResourceOpen(true)}
          >
            Add Resource
          </Button>
        )}
      </Box>

      {/* Horizontal video strip */}
      {videoResources.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Featured Videos</Typography>
          <Box sx={{ display: 'flex', overflowX: 'auto', gap: 2, pb: 1 }}>
            {videoResources.map((video) => (
              <Card key={video.id} sx={{ minWidth: 320 }}>
                <ReactPlayer url={video.file_url} width={320} height={180} />
                <CardContent>
                  <Typography variant="subtitle1" noWrap>{video.title}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {video.description}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}> {/* Adjusted Grid size */}
            <TextField
              fullWidth
              placeholder="Search resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}> {/* Adjusted Grid size */}
            <TextField // New Tags Filter
              fullWidth
              label="Filter by Tags (comma-separated)"
              variant="outlined"
              value={filterTags}
              onChange={(e) => setFilterTags(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={4}> {/* Adjusted Grid size */}
            <FormControl fullWidth>
              <InputLabel>Language</InputLabel>
              <Select // New Language Filter
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                label="Language"
              >
                <MenuItem value="">All</MenuItem>
                {languages.map((lang) => (
                  <MenuItem key={lang} value={lang}>{lang.toUpperCase()}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories.map(category => (
                  <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="article">Articles</MenuItem>
                <MenuItem value="video">Videos</MenuItem>
                <MenuItem value="audio">Audio</MenuItem>
                <MenuItem value="document">Documents</MenuItem>
                <MenuItem value="link">Links</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Featured Resources" />
          <Tab label="All Resources" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {featuredResources.map((resource) => (
            <Grid item xs={12} sm={6} md={4} key={resource.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {resource.resource_type === 'video' ? (
                  <ReactPlayer url={resource.file_url} width="100%" height="200px" />
                ) : (
                  resource.thumbnail_url && (
                    <CardMedia
                      component="img"
                      height="200"
                      image={resource.thumbnail_url}
                      alt={resource.title}
                    />
                  )
                )}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {getResourceIcon(resource.resource_type)}
                    <Chip
                      label={resource.resource_type}
                      color={getResourceColor(resource.resource_type)}
                      size="small"
                    />
                    {resource.duration_minutes && (
                      <Typography variant="caption" color="text.secondary">
                        {resource.duration_minutes} min
                      </Typography>
                    )}
                  </Box>
                  
                  <Typography variant="h6" gutterBottom>
                    {resource.title}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {resource.description}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                    {resource.tags && resource.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                    {resource.language && (
                      <Chip label={`Lang: ${resource.language}`} size="small" variant="outlined" />
                    )}
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {resource.view_count} views
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={resource.resource_type === 'video' ? <PlayIcon /> : undefined}
                      href={resource.file_url}
                      target="_blank"
                    >
                      {resource.resource_type === 'video' ? 'Watch' : 'Read'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {allResources.map((resource) => (
            <Grid item xs={12} sm={6} md={4} key={resource.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {resource.resource_type === 'video' ? (
                  <ReactPlayer url={resource.file_url} width="100%" height="200px" />
                ) : (
                  resource.thumbnail_url && (
                    <CardMedia
                      component="img"
                      height="200"
                      image={resource.thumbnail_url}
                      alt={resource.title}
                    />
                  )
                )}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {getResourceIcon(resource.resource_type)}
                    <Chip
                      label={resource.resource_type}
                      color={getResourceColor(resource.resource_type)}
                      size="small"
                    />
                    {resource.is_featured && (
                      <Chip label="Featured" color="warning" size="small" />
                    )}
                  </Box>
                  
                  <Typography variant="h6" gutterBottom>
                    {resource.title}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {resource.description}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                    {resource.tags && resource.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                    {resource.language && (
                      <Chip label={`Lang: ${resource.language}`} size="small" variant="outlined" />
                    )}
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {resource.view_count} views
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={resource.resource_type === 'video' ? <PlayIcon /> : undefined}
                      href={resource.file_url}
                      target="_blank"
                    >
                      {resource.resource_type === 'video' ? 'Watch' : 'Read'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>
      <AddResourceDialog
        open={addResourceOpen}
        onClose={() => setAddResourceOpen(false)}
        categories={categories}
        onAddResource={handleAddResource}
      />
    </Box>
  );
};

export default ResourcesPage;
