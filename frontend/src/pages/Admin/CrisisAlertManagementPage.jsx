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
} from '@mui/material';
import LoadingSpinner from '../../components/LoadingSpinner';

const CrisisAlertManagementPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use hard-coded sample alerts for admin demo
    const sampleAlerts = [
      { id: 1, first_name: 'Aisha', last_name: 'Kaur', severity: 9, status: 'active', description: 'Student reports self-harm ideation', created_at: new Date().toISOString() },
      { id: 2, first_name: 'Rohit', last_name: 'Sharma', severity: 7, status: 'acknowledged', description: 'High anxiety after exams', created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
      { id: 3, first_name: 'Maya', last_name: 'Patel', severity: 4, status: 'resolved', description: 'Follow-up completed', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
    ];
    setAlerts(sampleAlerts);
    setLoading(false);
  }, []);

  // Network fetching removed for demo/hardcoded mode

  const getSeverityColor = (severity) => {
    if (severity >= 8) return 'error';
    if (severity >= 6) return 'warning';
    return 'info';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'error';
      case 'acknowledged': return 'warning';
      case 'resolved': return 'success';
      default: return 'default';
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading crisis alerts..." />;
  }

  // No runtime error state in demo mode

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Crisis Alert Management
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {alerts.map((alert) => (
              <TableRow key={alert.id}>
                <TableCell>{alert.first_name} {alert.last_name}</TableCell>
                <TableCell>
                  <Chip label={alert.severity} color={getSeverityColor(alert.severity)} size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={alert.status} color={getStatusColor(alert.status)} size="small" />
                </TableCell>
                <TableCell>{alert.description}</TableCell>
                <TableCell>{new Date(alert.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Button size="small" variant="outlined">
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default CrisisAlertManagementPage;
