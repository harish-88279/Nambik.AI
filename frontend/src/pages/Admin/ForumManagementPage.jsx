import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
} from '@mui/material';
// api import removed for hard-coded demo data
import LoadingSpinner from '../../components/LoadingSpinner';
import AddForumThreadDialog from '../../components/AddForumThreadDialog';

const ForumManagementPage = () => {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAddThreadDialog, setOpenAddThreadDialog] = useState(false);

  useEffect(() => {
    // Use hard-coded sample threads for demo mode
    const sampleThreads = [
      { id: 101, title: 'Coping with exam stress', category_name: 'Stress', is_anonymous: false, reply_count: 12, last_activity: new Date().toISOString() },
      { id: 102, title: 'How to talk to my counselor', category_name: 'Guidance', is_anonymous: true, reply_count: 5, last_activity: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString() },
      { id: 103, title: 'Resources for sleep issues', category_name: 'Sleep', is_anonymous: false, reply_count: 8, last_activity: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
    ];
    setThreads(sampleThreads);
    setLoading(false);
  }, []);

  // Network fetching removed for demo/hardcoded threads

  const handleAddThread = async (newThreadData) => {
    // Append the new thread locally for demo/hardcoded mode
    const newThread = {
      id: Date.now(),
      title: newThreadData.title || 'Untitled',
      category_name: newThreadData.category_name || 'General',
      is_anonymous: !!newThreadData.is_anonymous,
      reply_count: 0,
      last_activity: new Date().toISOString(),
    };
    setThreads((prevThreads) => [...prevThreads, newThread]);
    setOpenAddThreadDialog(false);
  };

  const handleClickOpenAddThreadDialog = () => {
    setOpenAddThreadDialog(true);
  };

  const handleCloseAddThreadDialog = () => {
    setOpenAddThreadDialog(false);
  };

  if (loading) {
    return <LoadingSpinner message="Loading forum threads..." />;
  }

  // No runtime error state in demo mode

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Forum Management</Typography>
        <Button variant="contained" onClick={handleClickOpenAddThreadDialog}>
          Add Forum Thread
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Anonymous</TableCell>
              <TableCell>Replies</TableCell>
              <TableCell>Last Activity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {threads.map((thread) => (
              <TableRow key={thread.id}>
                <TableCell>{thread.title}</TableCell>
                <TableCell>{thread.category_name}</TableCell>
                <TableCell>{thread.is_anonymous ? 'Yes' : 'No'}</TableCell>
                <TableCell>{thread.reply_count}</TableCell>
                <TableCell>{new Date(thread.last_activity).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <AddForumThreadDialog
        open={openAddThreadDialog}
        handleClose={handleCloseAddThreadDialog}
        onAddThread={handleAddThread}
      />
    </Box>
  );
};

export default ForumManagementPage;
