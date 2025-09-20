import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Person as PersonIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Comment as CommentIcon,
} from '@mui/icons-material';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../services/api';

const ForumPage = () => {
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNewThread, setOpenNewThread] = useState(false);
  const [openNewPost, setOpenNewPost] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadCategory, setNewThreadCategory] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const loadForumData = async () => {
      try {
        setLoading(true);
        const [catRes, threadsRes] = await Promise.all([
          api.get('/resources/categories'), // Assuming forum categories share same table; update if separate
          api.get('/forum/threads'),
        ]);
        setCategories(catRes.data.categories || []);
        const apiThreads = (threadsRes.data.threads || []).map(t => ({
          id: t.id,
          title: t.title,
          category: t.category_name,
          author: t.is_anonymous ? 'Anonymous' : t.author_name || 'Anonymous',
          isAnonymous: t.is_anonymous,
          replyCount: Number(t.reply_count) || 0,
          lastActivity: new Date(t.last_activity || t.created_at).toLocaleString(),
          isPinned: t.is_pinned,
          isLocked: t.is_locked,
        }));
        setThreads(apiThreads);
      } catch (error) {
        console.error('Error loading forum data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadForumData();
  }, []);

  const handleThreadClick = async (thread) => {
    setSelectedThread(thread);
    try {
      const res = await api.get(`/forum/threads/${thread.id}/posts`);
      const apiPosts = (res.data.posts || []).map(p => ({
        id: p.id,
        content: p.content,
        author: p.is_anonymous ? 'Anonymous' : `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Anonymous',
        isAnonymous: p.is_anonymous,
        upvotes: p.upvotes || 0,
        downvotes: p.downvotes || 0,
        createdAt: new Date(p.created_at).toLocaleString(),
      }));
      setPosts(apiPosts);
    } catch (e) {
      console.error('Failed to load posts', e);
      setPosts([]);
    }
  };

  const handleCreateThread = async () => {
    try {
      const res = await api.post('/forum/threads', {
        title: newThreadTitle,
        categoryId: newThreadCategory,
        isAnonymous: true,
      });
      if (res.data.success) {
        // Refresh threads list
        const threadsRes = await api.get('/forum/threads');
        const apiThreads = (threadsRes.data.threads || []).map(t => ({
          id: t.id,
          title: t.title,
          category: t.category_name,
          author: t.is_anonymous ? 'Anonymous' : t.author_name || 'Anonymous',
          isAnonymous: t.is_anonymous,
          replyCount: Number(t.reply_count) || 0,
          lastActivity: new Date(t.last_activity || t.created_at).toLocaleString(),
          isPinned: t.is_pinned,
          isLocked: t.is_locked,
        }));
        setThreads(apiThreads);
      }
    } catch (e) {
      console.error('Failed to create thread', e);
    } finally {
      setOpenNewThread(false);
      setNewThreadTitle('');
      setNewThreadCategory('');
    }
  };

  const handleCreatePost = async () => {
    try {
      if (!selectedThread) return;
      const res = await api.post(`/forum/threads/${selectedThread.id}/posts`, {
        content: newPostContent,
        isAnonymous: true,
      });
      if (res.data.success) {
        // reload posts
        const postsRes = await api.get(`/forum/threads/${selectedThread.id}/posts`);
        const apiPosts = (postsRes.data.posts || []).map(p => ({
          id: p.id,
          content: p.content,
          author: p.is_anonymous ? 'Anonymous' : `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Anonymous',
          isAnonymous: p.is_anonymous,
          upvotes: p.upvotes || 0,
          downvotes: p.downvotes || 0,
          createdAt: new Date(p.created_at).toLocaleString(),
        }));
        setPosts(apiPosts);
      }
    } catch (e) {
      console.error('Failed to create post', e);
    } finally {
      setOpenNewPost(false);
      setNewPostContent('');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading forum..." />;
  }

  if (selectedThread) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Button onClick={() => setSelectedThread(null)} sx={{ mb: 1 }}>
              ← Back to Forum
            </Button>
            <Typography variant="h4">
              {selectedThread.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedThread.category} • {selectedThread.replyCount} replies
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenNewPost(true)}
          >
            Reply
          </Button>
        </Box>

        <Card>
          <CardContent>
            <List>
              {posts.map((post) => (
                <ListItem key={post.id} divider>
                  <Avatar sx={{ mr: 2 }}>
                    <PersonIcon />
                  </Avatar>
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          {post.content}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Button size="small" startIcon={<ThumbUpIcon />}>
                            {post.upvotes}
                          </Button>
                          <Button size="small" startIcon={<ThumbDownIcon />}>
                            {post.downvotes}
                          </Button>
                          <Typography variant="caption" color="text.secondary">
                            {post.createdAt}
                          </Typography>
                        </Box>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {post.author}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        <Dialog open={openNewPost} onClose={() => setOpenNewPost(false)} maxWidth="md" fullWidth>
          <DialogTitle>Reply to Thread</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              multiline
              rows={6}
              placeholder="Share your thoughts..."
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenNewPost(false)}>Cancel</Button>
            <Button onClick={handleCreatePost} variant="contained">
              Post Reply
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Peer Support Forum
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenNewThread(true)}
        >
          New Thread
        </Button>
      </Box>

      <Card>
        <CardContent>
          <List>
            {threads.map((thread) => (
              <ListItem
                key={thread.id}
                button
                onClick={() => handleThreadClick(thread)}
                divider
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {thread.isPinned && (
                        <Chip label="Pinned" color="warning" size="small" />
                      )}
                      {thread.isLocked && (
                        <Chip label="Locked" color="error" size="small" />
                      )}
                      <Typography variant="h6">
                        {thread.title}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {thread.category} • {thread.author} • {thread.lastActivity}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CommentIcon color="action" />
                    <Typography variant="body2">
                      {thread.replyCount}
                    </Typography>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Dialog open={openNewThread} onClose={() => setOpenNewThread(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Thread</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Thread Title"
            value={newThreadTitle}
            onChange={(e) => setNewThreadTitle(e.target.value)}
            sx={{ mt: 2 }}
          />
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={newThreadCategory}
              onChange={(e) => setNewThreadCategory(e.target.value)}
            >
              {categories.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewThread(false)}>Cancel</Button>
          <Button onClick={handleCreateThread} variant="contained">
            Create Thread
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ForumPage;
