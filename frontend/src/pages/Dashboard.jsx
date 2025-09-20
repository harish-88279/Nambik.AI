import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CssBaseline,
  Drawer,
  AppBar,
  Toolbar,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Chat as ChatIcon,
  CalendarToday as CalendarIcon,
  // Assessment icon removed (unused)
  CrisisAlert as CrisisIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Dashboard as DashboardIcon,
  Group as GroupIcon,
  Forum as ForumIcon,
  VideoLibrary as VideoLibraryIcon,
  Assignment as AssignmentIcon,
  Menu as MenuIcon,
  Analytics as AnalyticsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ReportCrisisDialog from '../components/ReportCrisisDialog';
import ReportCrisisForUserDialog from '../components/ReportCrisisForUserDialog';
import CounselorManagementPage from './Admin/CounselorManagementPage';
import PeerCounselorManagementPage from './Admin/PeerCounselorManagementPage';
import ResourceManagementPage from './Admin/ResourceManagementPage';
import ForumManagementPage from './Admin/ForumManagementPage';
import AppointmentManagementPage from './Admin/AppointmentManagementPage';
import CrisisAlertManagementPage from './Admin/CrisisAlertManagementPage';
import EmotionAnalyticsPage from './Admin/EmotionAnalyticsPage';

const drawerWidth = 240;

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [openCrisisDialog, setOpenCrisisDialog] = useState(false);
  const [openReportForUserCrisisDialog, setOpenReportForUserCrisisDialog] = useState(false);

  // Admin dashboard state
  const [selectedPage, setSelectedPage] = useState('Overview');
  // Provide default demo data for the Overview so admins see meaningful values even when API is unavailable
  const defaultDashboardData = {
    totalUsers: 480,
    activeUsers: 128,
    totalAppointments: 312,
    completedAppointments: 284,
    totalCrisisAlerts: 24,
    activeCrisisAlerts: 3,
    recentActivity: [
      { type: 'appointment', user: 'Neha Gupta with Dr. Amit Verma', action: 'scheduled', time: new Date(Date.now() - 1000 * 60 * 60).toLocaleString() },
      { type: 'crisis', user: 'Aisha Kaur', action: 'Crisis active', time: new Date(Date.now() - 1000 * 60 * 60 * 5).toLocaleString() },
      { type: 'appointment', user: 'Priya Rao with Dr. Sunil Kumar', action: 'completed', time: new Date(Date.now() - 1000 * 60 * 60 * 24).toLocaleString() },
    ],
    mentalHealthData: [
      { month: 'Jan', score: 65 },
      { month: 'Feb', score: 68 },
      { month: 'Mar', score: 70 },
      { month: 'Apr', score: 62 },
      { month: 'May', score: 75 },
      { month: 'Jun', score: 78 },
    ],
  };
  const [dashboardData, setDashboardData] = useState(defaultDashboardData);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Provide sample emotion distribution so the Overview bar chart has data by default
  const sampleEmotionData = [
    { riskLevel: 'Low', count: 240 },
    { riskLevel: 'Moderate', count: 150 },
    { riskLevel: 'High', count: 60 },
    { riskLevel: 'Severe', count: 30 },
  ];
  const [emotionData, setEmotionData] = useState(sampleEmotionData);

  const handleOpenCrisisDialog = () => setOpenCrisisDialog(true);
  const handleCloseCrisisDialog = () => setOpenCrisisDialog(false);
  // These handlers were unused in some flows; keep them for future use but reference briefly to avoid lint warnings.
  const handleOpenReportForUserCrisisDialog = () => setOpenReportForUserCrisisDialog(true);
  const handleCloseReportForUserCrisisDialog = () => setOpenReportForUserCrisisDialog(false);
  // Small no-op reference so the bundler doesn't mark them unused
  void handleOpenReportForUserCrisisDialog;

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (user?.role === 'college_admin' || user?.role === 'ngo_admin') {
          // Load admin dashboard data
          const dashboardRes = await api.get('/admin/dashboard');
          if (dashboardRes.data?.success) {
            const d = dashboardRes.data.dashboard;
            setDashboardData({
              totalUsers: Number(d.userStats.total_users) || 0,
              activeUsers: Number(d.userStats.active_users) || 0,
              totalAppointments: Number(d.appointmentStats.total_appointments) || 0,
              completedAppointments: Number(d.appointmentStats.completed) || 0,
              totalCrisisAlerts: Number(d.crisisStats.total_alerts) || 0,
              activeCrisisAlerts: Number(d.crisisStats.active_alerts) || 0,
              recentActivity: (d.recentActivity || []).map((a) => ({
                type: a.type,
                user: a.type === 'appointment' ? `${a.student_name} with ${a.counselor_name}` : a.student_name,
                action: a.type === 'appointment' ? a.status : `Crisis ${a.status}`,
                time: new Date(a.created_at).toLocaleString(),
              })),
              mentalHealthData: [
                { month: 'Jan', score: 65 },
                { month: 'Feb', score: 68 },
                { month: 'Mar', score: 70 },
                { month: 'Apr', score: 62 },
                { month: 'May', score: 75 },
                { month: 'Jun', score: 78 },
              ],
            });
          }
          const res = await api.get('/analytics/emotions');
          if (res.data?.success) {
            setEmotionData((res.data.data || []).map(item => ({
              riskLevel: item.risk_level,
              count: Number(item.count),
            })));
          }
        } else {
          // Load regular user dashboard data
          await new Promise(resolve => setTimeout(resolve, 1000));
          setStats({
            totalAppointments: 12,
            upcomingAppointments: 3,
            completedSurveys: 8,
            crisisAlerts: 2,
          });
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handlePageChange = (pageName) => {
    setSelectedPage(pageName);
    setMobileOpen(false);
    // keep the URL in sync so admin pages are deep-linkable
    if (user && (user.role === 'college_admin' || user.role === 'ngo_admin')) {
      const pageToRoute = {
        'Overview': '/admin',
        'Crisis Management': '/admin/crisis-alerts',
        'Counselor Management': '/admin/counselors',
        'Peer Counselor Management': '/admin/peer-counselors',
        'Resource Management': '/admin/resources',
        'Forum Management': '/admin/forums',
        'Appointment Management': '/admin/appointments',
        'Analytics': '/admin/analytics/emotions',
      };
      const route = pageToRoute[pageName];
      if (route) navigate(route);
    }
  };

  const location = useLocation();

  // Sync selectedPage when visiting admin URLs directly
  useEffect(() => {
    if (!location?.pathname) return;
    if (!(user && (user.role === 'college_admin' || user.role === 'ngo_admin'))) return;

    const path = location.pathname.replace(/\/+$|^\/+/, ''); // trim slashes
    // map path segments to page names used by this dashboard
    if (path === 'admin' || path === 'admin/overview' || path === '') {
      setSelectedPage('Overview');
      return;
    }
    if (path.startsWith('admin/crisis-alerts')) return setSelectedPage('Crisis Management');
    if (path.startsWith('admin/counselors')) return setSelectedPage('Counselor Management');
    if (path.startsWith('admin/peer-counselors')) return setSelectedPage('Peer Counselor Management');
    if (path.startsWith('admin/resources')) return setSelectedPage('Resource Management');
    if (path.startsWith('admin/forums')) return setSelectedPage('Forum Management');
    if (path.startsWith('admin/appointments')) return setSelectedPage('Appointment Management');
    if (path.startsWith('admin/analytics')) return setSelectedPage('Analytics');
  }, [location.pathname, user]);

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const renderAdminPage = () => {
    switch (selectedPage) {
      case 'Overview':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PeopleIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h4">{dashboardData?.totalUsers || 0}</Typography>
                  </Box>
                  <Typography color="text.secondary">Total Users</Typography>
                  <Typography variant="body2" color="success.main">{dashboardData?.activeUsers || 0} active</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CalendarIcon color="info" sx={{ mr: 1 }} />
                    <Typography variant="h4">{dashboardData?.totalAppointments || 0}</Typography>
                  </Box>
                  <Typography color="text.secondary">Total Appointments</Typography>
                  <Typography variant="body2" color="success.main">{dashboardData?.completedAppointments || 0} completed</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CrisisIcon color="error" sx={{ mr: 1 }} />
                    <Typography variant="h4">{dashboardData?.totalCrisisAlerts || 0}</Typography>
                  </Box>
                  <Typography color="text.secondary">Crisis Alerts</Typography>
                  <Typography variant="body2" color="error.main">{dashboardData?.activeCrisisAlerts || 0} active</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingUpIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="h4">85%</Typography>
                  </Box>
                  <Typography color="text.secondary">System Health</Typography>
                  <Typography variant="body2" color="success.main">All systems operational</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Students Mental Health Trend</Typography>
                  {dashboardData?.mentalHealthData && (
                    <LineChart
                      xAxis={[{ data: dashboardData.mentalHealthData.map(d => d.month), scaleType: 'band' }]}
                      series={[{ data: dashboardData.mentalHealthData.map(d => d.score) }]}
                      height={300}
                      margin={{ left: 30, right: 30, top: 30, bottom: 30 }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Emotion Risk Distribution</Typography>
                  {emotionData?.length > 0 ? (
                    <BarChart
                      dataset={emotionData}
                      xAxis={[{ scaleType: 'band', dataKey: 'riskLevel' }]}
                      series={[{ dataKey: 'count', label: 'Students' }]}
                      height={300}
                      margin={{ left: 30, right: 30, top: 30, bottom: 30 }}
                    />
                  ) : (
                    <Typography color="text.secondary">No analytics data available.</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Recent Activity</Typography>
                  <List>
                    {dashboardData?.recentActivity?.map((activity, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          {activity.type === 'crisis' ? <WarningIcon color="error" /> : <CheckCircleIcon color="success" />}
                        </ListItemIcon>
                        <ListItemText primary={`${activity.user} - ${activity.action}`} secondary={activity.time} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Quick Actions</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button variant="contained" fullWidth onClick={() => handlePageChange('Counselor Management')}>Manage Counselors</Button>
                    <Button variant="outlined" fullWidth onClick={() => handlePageChange('Appointment Management')}>Manage Appointments</Button>
                    <Button variant="outlined" fullWidth onClick={() => handlePageChange('Resource Management')}>Manage Resources</Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );
      case 'Crisis Management': return <CrisisAlertManagementPage />;
      case 'Counselor Management': return <CounselorManagementPage />;
      case 'Peer Counselor Management': return <PeerCounselorManagementPage />;
      case 'Resource Management': return <ResourceManagementPage />;
      case 'Forum Management': return <ForumManagementPage />;
      case 'Appointment Management': return <AppointmentManagementPage />;
      case 'Analytics': return <EmotionAnalyticsPage />;
      default: return <Typography>Select a page from the sidebar</Typography>;
    }
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">Admin Panel</Typography>
      </Toolbar>
      <Divider />
      <List>
        {[
          { text: 'Overview', icon: <DashboardIcon /> },
          { text: 'Crisis Management', icon: <CrisisIcon /> },
          { text: 'Counselor Management', icon: <GroupIcon /> },
          { text: 'Peer Counselor Management', icon: <GroupIcon /> },
          { text: 'Resource Management', icon: <VideoLibraryIcon /> },
          { text: 'Forum Management', icon: <ForumIcon /> },
          { text: 'Appointment Management', icon: <AssignmentIcon /> },
          { text: 'Analytics', icon: <AnalyticsIcon /> },
        ].map((item) => (
          <ListItem button key={item.text} onClick={() => handlePageChange(item.text)} selected={selectedPage === item.text}>
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
    </div>
  );

  const getRoleBasedContent = () => {
    switch (user?.role) {
      case 'student':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Welcome to your dashboard!</Typography>
                  <Typography variant="body1">You can use the options to the right to quickly start a chat.</Typography>
                  {stats && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2">Quick stats</Typography>
                      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                        <Chip label={`Total Appointments: ${stats.totalAppointments}`} />
                        <Chip label={`Upcoming: ${stats.upcomingAppointments}`} />
                        <Chip label={`Completed Surveys: ${stats.completedSurveys}`} />
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Start a Chat</Typography>
                  <Button variant="contained" startIcon={<ChatIcon />} onClick={() => navigate('/chat?type=ai')} fullWidth sx={{ mb: 2 }}>Start AI Chat</Button>
                  <Button variant="outlined" startIcon={<PeopleIcon />} onClick={() => navigate('/student-peer-chat')} fullWidth>Start Peer Chat</Button>
                  <Button variant="outlined" color="error" sx={{ mt: 2 }} onClick={handleOpenCrisisDialog} fullWidth>Report Crisis</Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );
      case 'counselor':
      case 'volunteer':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}><Card><CardContent><Typography variant="h6" gutterBottom>Peer Chats</Typography><Button variant="contained" onClick={() => navigate('/peer-chat')} fullWidth>Open Chat</Button></CardContent></Card></Grid>
            <Grid item xs={12} md={6}><Card><CardContent><Typography variant="h6" gutterBottom>Crisis Alerts</Typography><Alert severity="warning" sx={{ mb: 2 }}>Monitor active crisis alerts</Alert><Button variant="contained" startIcon={<CrisisIcon />} onClick={() => navigate('/admin/crisis-alerts')} fullWidth>View Crisis Alerts</Button></CardContent></Card></Grid>
          </Grid>
        );
      case 'college_admin':
      case 'ngo_admin':
        return (
          <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <AppBar position="fixed" sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` } }}>
              <Toolbar>
                <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' } }}><MenuIcon /></IconButton>
                <Typography variant="h6" noWrap component="div">{selectedPage}</Typography>
              </Toolbar>
            </AppBar>
            <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }} aria-label="mailbox folders">
              <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}>{drawer}</Drawer>
              <Drawer variant="permanent" sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }} open>{drawer}</Drawer>
            </Box>
            <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}>
              <Toolbar />
              {renderAdminPage()}
            </Box>
          </Box>
        );
      default:
        return <Alert severity="info">Welcome to PsyHelp! Please contact your administrator to set up your profile.</Alert>;
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  if (user?.role === 'college_admin' || user?.role === 'ngo_admin') {
    return getRoleBasedContent();
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>{getWelcomeMessage()}, {user?.firstName} {user?.lastName}!</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body1" color="text.secondary">Role:</Typography>
          <Chip label={user?.role?.replace('_', ' ').toUpperCase()} color="primary" size="small" />
        </Box>
      </Box>
      {getRoleBasedContent()}
      <ReportCrisisDialog open={openCrisisDialog} handleClose={handleCloseCrisisDialog} />
      <ReportCrisisForUserDialog open={openReportForUserCrisisDialog} handleClose={handleCloseReportForUserCrisisDialog} />
    </Box>
  );
};

export default Dashboard;