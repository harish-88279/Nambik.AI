import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  VideoCall as VideoCallIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../services/api';
import FeedbackDialog from '../components/FeedbackDialog';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

const AppointmentsPage = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCounselor, setSelectedCounselor] = useState('');
  const [appointmentType, setAppointmentType] = useState('virtual');
  const [scheduledAt, setScheduledAt] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [meetingLink, setMeetingLink] = useState('');
  const [location, setLocation] = useState('');
  const [studentNotes, setStudentNotes] = useState('');
  // removed duplicate import
  const [availableCounselors, setAvailableCounselors] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [openFeedbackDialog, setOpenFeedbackDialog] = useState(false);
  const [feedbackAppointment, setFeedbackAppointment] = useState(null);
  const [bookingError, setBookingError] = useState('');
  const { user } = useAuth();

  // Demo student points/stats (visible to students)
  const demoStudentPoints = {
    pointsEarned: 120,
    sessionsAttended: 9,
    feedbackScoreAvg: 4.6,
  };

  useEffect(() => {
    fetchAppointments();
    if (user?.role === 'student') {
      fetchAvailableCounselors();
    }
  }, [user]);

  const handleOpenFeedbackDialog = (appointment) => {
    setFeedbackAppointment(appointment);
    setOpenFeedbackDialog(true);
  };

  const handleCloseFeedbackDialog = () => {
    setOpenFeedbackDialog(false);
    setFeedbackAppointment(null);
  };
    const fetchCounselorSlots = useCallback(async () => {
      setFetchingSlots(true);
      setBookingError('');
      try {
        const date = scheduledAt.toISOString().split('T')[0]; // YYYY-MM-DD
        const response = await api.get(`/appointments/counselors/${selectedCounselor}/available-slots?from=${date}&to=${date}`);
        if (response.data.success) {
          setAvailableSlots(response.data.slots);
        }
      } catch (error) {
        console.error('Error fetching counselor slots:', error);
        setBookingError('Failed to fetch available slots. Please try again.');
      } finally {
        setFetchingSlots(false);
      }
    }, [selectedCounselor, scheduledAt]);

    useEffect(() => {
      if (selectedCounselor && scheduledAt) {
        fetchCounselorSlots();
      } else {
        setAvailableSlots([]);
      }
    }, [selectedCounselor, scheduledAt, fetchCounselorSlots]);

  const fetchAppointments = async () => {
    try {
      const response = await api.get('/appointments');
      if (response.data.success) {
        setAppointments(response.data.appointments);
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCounselors = async () => {
    // Provide two hard-coded counselors for student booking demo
    const demoCounselors = [
      { id: 'c1', first_name: 'Counselor', last_name: 'One' },
      { id: 'c2', first_name: 'Counselor', last_name: 'Two' },
    ];
    setAvailableCounselors(demoCounselors);

    // Optionally try to load from API and override demo if available
    try {
      const response = await api.get('/appointments/counselors/available');
      if (response?.data?.success && Array.isArray(response.data.counselors) && response.data.counselors.length) {
        setAvailableCounselors(response.data.counselors);
      }
    } catch (error) {
      // Keep demo counselors if API call fails
      console.debug('Could not fetch live counselors, using demo list');
    }
  };

  // fetchCounselorSlots is implemented above using useCallback

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'info';
      case 'confirmed': return 'primary';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      case 'no_show': return 'default';
      default: return 'default';
    }
  };

  const handleBookAppointment = () => {
    setOpenDialog(true);
    setBookingError('');
    setScheduledAt(null);
    setSelectedCounselor('');
    setAvailableSlots([]);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedCounselor('');
    setAppointmentType('virtual');
    setScheduledAt(null);
    setDurationMinutes(60);
    setMeetingLink('');
    setLocation('');
    setStudentNotes('');
    setBookingError('');
  };

  const handleSubmitAppointment = async () => {
    setBookingError('');
    if (!selectedCounselor || !scheduledAt || !appointmentType) {
      setBookingError('Please fill in all required fields.');
      return;
    }

    try {
      const response = await api.post('/appointments', {
        counselorId: selectedCounselor,
        appointmentType,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes,
        meetingLink,
        location,
        studentNotes,
      });
      if (response?.data?.success && response.data.appointment) {
        // Append newly created appointment returned by API
        setAppointments((prev) => [response.data.appointment, ...prev]);
        setSnackbar({ open: true, message: 'Appointment booked successfully', severity: 'success' });
      } else {
        // Unexpected response - fallback to local append
        const local = createLocalAppointment({
          counselorId: selectedCounselor,
          appointmentType,
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes,
        });
        setAppointments((prev) => [local, ...prev]);
        setSnackbar({ open: true, message: 'Appointment booked (demo)', severity: 'success' });
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Error booking appointment:', error);
      // API failed - create a local demo appointment so user sees it immediately
      const local = createLocalAppointment({
        counselorId: selectedCounselor,
        appointmentType,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes,
      });
      setAppointments((prev) => [local, ...prev]);
      setSnackbar({ open: true, message: 'Appointment booked (offline/demo)', severity: 'success' });
      handleCloseDialog();
    }
  };

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const handleCloseSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  const createLocalAppointment = ({ counselorId, appointmentType, scheduledAt: schedIso, durationMinutes: dur }) => {
    const id = Math.floor(Math.random() * 1000000) + 1000;
    const counselor = availableCounselors.find((c) => c.id === counselorId) || { first_name: 'Dr.', last_name: 'Counselor' };
    return {
      id,
      counselor_first_name: counselor.first_name || 'Dr.',
      counselor_last_name: counselor.last_name || 'Counselor',
      scheduled_at: schedIso || new Date().toISOString(),
      duration_minutes: dur || 60,
      status: 'scheduled',
      appointment_type: appointmentType || 'virtual',
    };
  };

  const handleAcceptAppointment = async (appointmentId) => {
    try {
      const response = await api.patch(`/appointments/${appointmentId}/status`, {
        status: 'confirmed',
      });
      if (response.data.success) {
        fetchAppointments(); // Refresh appointments list
      }
    } catch (error) {
      console.error('Error accepting appointment:', error);
      // TODO: Show error message to user
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading appointments..." />;
  }

  return (
    <Box>
      {user?.role === 'student' && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Card sx={{ minWidth: 180 }}>
            <CardContent>
              <Typography variant="h6">Points Earned</Typography>
              <Typography variant="h4" color="primary">{demoStudentPoints.pointsEarned}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 180 }}>
            <CardContent>
              <Typography variant="h6">Sessions Attended</Typography>
              <Typography variant="h4">{demoStudentPoints.sessionsAttended}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 180 }}>
            <CardContent>
              <Typography variant="h6">Avg Feedback</Typography>
              <Typography variant="h4" color="success.main">{demoStudentPoints.feedbackScoreAvg}</Typography>
            </CardContent>
          </Card>
        </Box>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Appointments
        </Typography>
        {user?.role === 'student' && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleBookAppointment}
          >
            Book Appointment
          </Button>
        )}
      </Box>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Counselor</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Date & Time</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>{appointment.counselor_first_name} {appointment.counselor_last_name}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {appointment.appointment_type === 'virtual' ? (
                          <VideoCallIcon color="primary" />
                        ) : (
                          <LocationIcon color="secondary" />
                        )}
                        <Typography variant="body2">
                          {appointment.appointment_type === 'virtual' ? 'Virtual' : 'In-Person'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {new Date(appointment.scheduled_at).toLocaleDateString()} at{' '}
                      {new Date(appointment.scheduled_at).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>{appointment.duration_minutes} minutes</TableCell>
                    <TableCell>
                      <Chip
                        label={appointment.status.replace('_', ' ')}
                        color={getStatusColor(appointment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined">
                        View Details
                      </Button>
                      {user?.role === 'counselor' && appointment.status === 'scheduled' && (
                        <Button
                          size="small"
                          variant="contained"
                          sx={{ ml: 1 }}
                          onClick={() => handleAcceptAppointment(appointment.id)}
                        >
                          Accept
                        </Button>
                      )}
                      {appointment.status === 'completed' && user?.role === 'student' && (
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ ml: 1 }}
                          onClick={() => handleOpenFeedbackDialog(appointment)}
                        >
                          Give Feedback
                        </Button>
                      )}
                      {appointment.status === 'completed' && user?.role === 'counselor' && (
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ ml: 1 }}
                          onClick={() => handleOpenFeedbackDialog(appointment)}
                        >
                          Give Feedback
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>



      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Book New Appointment</DialogTitle>
        <DialogContent>
          {bookingError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {bookingError}
            </Alert>
          )}
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Counselor</InputLabel>
                  <Select
                    value={selectedCounselor}
                    onChange={(e) => setSelectedCounselor(e.target.value)}
                  >
                    {availableCounselors.map((counselor) => (
                      <MenuItem key={counselor.id} value={counselor.id}>
                        {counselor.first_name} {counselor.last_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <DateTimePicker
                  label="Scheduled Date & Time"
                  value={scheduledAt}
                  onChange={(newValue) => setScheduledAt(newValue)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              {selectedCounselor && scheduledAt && fetchingSlots ? (
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress />
                </Grid>
              ) : selectedCounselor && scheduledAt && availableSlots.length > 0 ? (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Select Time Slot</InputLabel>
                    <Select
                      value={scheduledAt ? scheduledAt.toISOString() : ''}
                      onChange={(e) => setScheduledAt(new Date(e.target.value))}
                    >
                      {availableSlots.map((slot) => (
                        <MenuItem key={slot} value={slot}>
                          {new Date(slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              ) : selectedCounselor && scheduledAt && !fetchingSlots && (
                <Grid item xs={12}>
                  <Typography color="text.secondary">No available slots for this date.</Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Appointment Type</InputLabel>
                  <Select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                  >
                    <MenuItem value="virtual">Virtual (Video Call)</MenuItem>
                    <MenuItem value="in_person">In-Person</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {appointmentType === 'virtual' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Meeting Link"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                  />
                </Grid>
              )}
              {appointmentType === 'in_person' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Your Notes/Concerns"
                  multiline
                  rows={3}
                  value={studentNotes}
                  onChange={(e) => setStudentNotes(e.target.value)}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmitAppointment} variant="contained">
            Book Appointment
          </Button>
        </DialogActions>
      </Dialog>

      {feedbackAppointment && (
        <FeedbackDialog
          open={openFeedbackDialog}
          handleClose={handleCloseFeedbackDialog}
          appointment={feedbackAppointment}
          senderUser={user}
          receiverUser={user?.role === 'student' ? { id: feedbackAppointment.counselor_id, first_name: feedbackAppointment.counselor_first_name, last_name: feedbackAppointment.counselor_last_name } : { id: feedbackAppointment.student_id, first_name: feedbackAppointment.student_first_name, last_name: feedbackAppointment.student_last_name }}
        />
      )}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AppointmentsPage;
