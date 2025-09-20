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
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Chip,
} from '@mui/material';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const CounselorManagementPage = () => {
  const [counselors, setCounselors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [newCounselor, setNewCounselor] = useState({ firstName: '', lastName: '', email: '' });

  useEffect(() => {
    fetchCounselors();
  }, []);

  const fetchCounselors = async () => {
    try {
      const response = await api.get('/admin/counselors');
      if (response.data.success) {
        setCounselors(response.data.data);
      }
    } catch (err) {
      setError('Failed to load counselors.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCounselor = async () => {
    try {
      const response = await api.post('/admin/counselors', newCounselor);
      if (response.data.success) {
        setCounselors([...counselors, response.data.data]);
        handleClose();
      }
    } catch (err) {
      setError('Failed to add counselor.');
      console.error(err);
    }
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setNewCounselor({ firstName: '', lastName: '', email: '' });
  };

  if (loading) {
    return <LoadingSpinner message="Loading counselors..." />;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Counselor Management</Typography>
        <Button variant="contained" onClick={handleClickOpen}>
          Add Counselor
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {counselors.map((counselor) => (
              <TableRow key={counselor.id}>
                <TableCell>{counselor.first_name} {counselor.last_name}</TableCell>
                <TableCell>{counselor.email}</TableCell>
                <TableCell>
                  <Chip label={counselor.is_active ? 'Active' : 'Inactive'} color={counselor.is_active ? 'success' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Add a New Counselor</DialogTitle>
        <DialogContent>
          <DialogContentText>
            To add a new counselor, please enter their details below.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="First Name"
            type="text"
            fullWidth
            variant="standard"
            value={newCounselor.firstName}
            onChange={(e) => setNewCounselor({ ...newCounselor, firstName: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Last Name"
            type="text"
            fullWidth
            variant="standard"
            value={newCounselor.lastName}
            onChange={(e) => setNewCounselor({ ...newCounselor, lastName: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            variant="standard"
            value={newCounselor.email}
            onChange={(e) => setNewCounselor({ ...newCounselor, email: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAddCounselor}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CounselorManagementPage;
