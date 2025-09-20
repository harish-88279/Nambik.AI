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
  Chip,
  Button,
  Snackbar,
  Alert,
} from '@mui/material';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import AddAppointmentDialog from '../../components/AddAppointmentDialog';

const AppointmentManagementPage = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAddAppointmentDialog, setOpenAddAppointmentDialog] = useState(false);

  useEffect(() => {
    // Use hard-coded appointments for demo mode
    const sampleAppointments = [
      { id: 201, student_first_name: 'Neha', student_last_name: 'Gupta', counselor_first_name: 'Dr. Amit', counselor_last_name: 'Verma', scheduled_at: new Date().toISOString(), status: 'scheduled', appointment_type: 'virtual' },
      { id: 202, student_first_name: 'Sanjay', student_last_name: 'Iyer', counselor_first_name: 'Dr. Rina', counselor_last_name: 'Das', scheduled_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), status: 'completed', appointment_type: 'in_person' },
      { id: 203, student_first_name: 'Priya', student_last_name: 'Rao', counselor_first_name: 'Dr. Sunil', counselor_last_name: 'Kumar', scheduled_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), status: 'confirmed', appointment_type: 'virtual' },
    ];
    setAppointments(sampleAppointments);
    setLoading(false);
  }, []);

  // Network fetching removed for demo/hardcoded appointments

  const handleAddAppointment = async (newAppointmentData) => {
    // Try to post to API, but fall back to local demo append if API is unreachable
    try {
      const response = await api.post('/appointments', newAppointmentData);
      if (response?.data?.success && response.data.appointment) {
        setAppointments((prevAppointments) => [...prevAppointments, response.data.appointment]);
      } else {
        // Fallback: create a local appointment shaped like the sample data
        const localAppointment = createLocalAppointment(newAppointmentData);
        setAppointments((prev) => [...prev, localAppointment]);
      }
    } catch (err) {
      console.warn('API not available, adding appointment locally for demo:', err);
      const localAppointment = createLocalAppointment(newAppointmentData);
      setAppointments((prev) => [...prev, localAppointment]);
    } finally {
      setOpenAddAppointmentDialog(false);
      setSnackbar({ open: true, message: 'Appointment booked successfully', severity: 'success' });
    }
  };

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const handleCloseSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  const createLocalAppointment = (data) => {
    const id = Math.floor(Math.random() * 100000) + 1000;
    const studentFirst = data.student?.first_name || data.student?.name || 'Student';
    const studentLast = data.student?.last_name || '';
    const counselorFirst = data.counselor?.first_name || data.counselor?.name || 'Counselor';
    const counselorLast = data.counselor?.last_name || '';
    return {
      id,
      student_first_name: studentFirst,
      student_last_name: studentLast,
      counselor_first_name: counselorFirst,
      counselor_last_name: counselorLast,
      scheduled_at: data.scheduledAt || new Date().toISOString(),
      status: 'scheduled',
      appointment_type: data.appointmentType || 'virtual',
    };
  };

  const handleClickOpenAddAppointmentDialog = () => {
    setOpenAddAppointmentDialog(true);
  };

  const handleCloseAddAppointmentDialog = () => {
    setOpenAddAppointmentDialog(false);
  };

  if (loading) {
    return <LoadingSpinner message="Loading appointments..." />;
  }

  // No runtime error state in demo mode

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Appointment Management</Typography>
        <Button variant="contained" onClick={handleClickOpenAddAppointmentDialog}>
          Add Appointment
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Student</TableCell>
              <TableCell>Counselor</TableCell>
              <TableCell>Scheduled At</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Type</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {appointments.map((appointment) => (
              <TableRow key={appointment.id}>
                <TableCell>{appointment.student_first_name} {appointment.student_last_name}</TableCell>
                <TableCell>{appointment.counselor_first_name} {appointment.counselor_last_name}</TableCell>
                <TableCell>{new Date(appointment.scheduled_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip label={appointment.status} color="primary" />
                </TableCell>
                <TableCell>{appointment.appointment_type}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <AddAppointmentDialog
        open={openAddAppointmentDialog}
        handleClose={handleCloseAddAppointmentDialog}
        onAddAppointment={handleAddAppointment}
      />

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AppointmentManagementPage;
