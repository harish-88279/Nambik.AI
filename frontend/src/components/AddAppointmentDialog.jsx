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
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { api } from '../services/api';

const AddAppointmentDialog = ({ open, handleClose, onAddAppointment }) => {
  const [studentId, setStudentId] = useState('');
  const [counselorId, setCounselorId] = useState('');
  const [appointmentType, setAppointmentType] = useState('virtual');
  const [scheduledAt, setScheduledAt] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [meetingLink, setMeetingLink] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [students, setStudents] = useState([]);
  const [counselors, setCounselors] = useState([]);

  useEffect(() => {
    if (open) {
      fetchUsers();
      // Reset form fields
      setStudentId('');
      setCounselorId('');
      setAppointmentType('virtual');
      setScheduledAt(null);
      setDurationMinutes(60);
      setMeetingLink('');
      setLocation('');
      setNotes('');
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      const studentsResponse = await api.get('/users?role=student'); // Assuming this endpoint exists
      if (studentsResponse.data.success) {
        setStudents(studentsResponse.data.users);
      }

      const counselorsResponse = await api.get('/users?role=counselor'); // Assuming this endpoint exists
      if (counselorsResponse.data.success) {
        setCounselors(counselorsResponse.data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
    }
  };

  const handleSubmit = () => {
    if (!studentId || !counselorId || !scheduledAt) {
      alert('Please fill in all required fields.');
      return;
    }

    // Find selected user objects so the parent can display names in demo mode
    const selectedStudent = students.find((s) => s.id === studentId) || { id: studentId };
    const selectedCounselor = counselors.find((c) => c.id === counselorId) || { id: counselorId };

    onAddAppointment({
      student: selectedStudent,
      counselor: selectedCounselor,
      appointmentType,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes,
      meetingLink,
      location,
      notes,
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>Add New Appointment</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="dense" required>
          <InputLabel>Student</InputLabel>
          <Select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            label="Student"
          >
            {students.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.first_name} {user.last_name} ({user.email})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="dense" required>
          <InputLabel>Counselor</InputLabel>
          <Select
            value={counselorId}
            onChange={(e) => setCounselorId(e.target.value)}
            label="Counselor"
          >
            {counselors.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.first_name} {user.last_name} ({user.email})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="dense" required>
          <InputLabel>Appointment Type</InputLabel>
          <Select
            value={appointmentType}
            onChange={(e) => setAppointmentType(e.target.value)}
            label="Appointment Type"
          >
            <MenuItem value="virtual">Virtual</MenuItem>
            <MenuItem value="in_person">In-Person</MenuItem>
          </Select>
        </FormControl>

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateTimePicker
            label="Scheduled At"
            value={scheduledAt}
            onChange={(newValue) => setScheduledAt(newValue)}
            renderInput={(params) => <TextField {...params} fullWidth margin="dense" required />}
          />
        </LocalizationProvider>

        <TextField
          margin="dense"
          label="Duration (minutes)"
          type="number"
          fullWidth
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          inputProps={{ min: 15, max: 180, step: 15 }}
        />

        {appointmentType === 'virtual' && (
          <TextField
            margin="dense"
            label="Meeting Link"
            type="url"
            fullWidth
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
          />
        )}

        {appointmentType === 'in_person' && (
          <TextField
            margin="dense"
            label="Location"
            type="text"
            fullWidth
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        )}

        <TextField
          margin="dense"
          label="Notes"
          type="text"
          fullWidth
          multiline
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">Add Appointment</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddAppointmentDialog;
