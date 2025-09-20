import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery,
  Paper,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Chat as ChatIcon,
  CalendarToday as CalendarIcon,
  LibraryBooks as ResourcesIcon,
  Forum as ForumIcon,
  Assessment as SurveysIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  CrisisAlert as CrisisIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const drawerWidth = 240;

const Layout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { assignedPeerChat } = useSocket();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const goToDashboard = () => {
    if (user && (user.role === 'college_admin' || user.role === 'ngo_admin')) {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleProfileMenuClose();
  };

  const menuItems = [];

  // Add menu items based on user role
  if (user) {
    switch (user.role) {
      case 'student':
        menuItems.push(
          { text: 'AI Chat', icon: <ChatIcon />, path: '/chat?type=ai' },
          { text: 'Peer Chat', icon: <ForumIcon />, path: '/student-peer-chat' },
          { text: 'Appointments', icon: <CalendarIcon />, path: '/appointments' },
          { text: 'Resources', icon: <ResourcesIcon />, path: '/resources' },
          { text: 'Forum', icon: <ForumIcon />, path: '/forum' },
          { text: 'Surveys', icon: <SurveysIcon />, path: '/surveys' }
        );
        break;
      case 'counselor':
        menuItems.push(
          { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
          { text: 'Appointments', icon: <CalendarIcon />, path: '/appointments' },
          { text: 'Forum', icon: <ForumIcon />, path: '/forum' },
          { text: 'Crisis Alerts', icon: <CrisisIcon />, path: '/admin/crisis' }
        );
        break;
      case 'college_admin':
      case 'ngo_admin':
        menuItems.push(
          { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
          { text: 'Admin Panel', icon: <AdminIcon />, path: '/admin' },
          { text: 'Crisis Alerts', icon: <CrisisIcon />, path: '/admin/crisis' }
        );
        break;
      default:
        break;
    }
  }

  // Add crisis alert for counselors and admins
  if (user && ['counselor', 'college_admin', 'ngo_admin'].includes(user.role)) {
    menuItems.push({ text: 'Crisis Alerts', icon: <CrisisIcon />, path: '/admin/crisis' });
  }

  const drawer = (
    <div>
      <Toolbar>
        <Box sx={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={goToDashboard}>
          <Typography variant="h6" noWrap component="div" sx={{ color: 'primary.main' }}>
            PsyHelp
          </Typography>
          {user && (
            <Typography variant="caption" color="text.secondary">{getWelcomeMessage()}, {user.firstName}</Typography>
          )}
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile) {
                  setMobileOpen(false);
                }
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, cursor: 'pointer' }} onClick={goToDashboard}>
            <Typography variant="h6" noWrap component="div">
              PsyHelp
            </Typography>
            {user && (
              <Typography variant="caption" color="inherit">{getWelcomeMessage()}, {user.firstName}</Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {user?.role === 'college_admin' || user?.role === 'ngo_admin' ? `${user?.firstName} ${user?.lastName}` : user?.lastName}
            </Typography>
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="primary-search-account-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                {user?.role === 'college_admin' || user?.role === 'ngo_admin' ? `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}` : user?.lastName?.[0] || ''}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}

        {/* Floating student chat launcher (anonymous quick chat) */}
        {user?.role === 'student' && (
          <Paper
            elevation={6}
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              p: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer'
            }}
            onClick={() => navigate('/student-peer-chat')}
          >
            <ForumIcon fontSize="small" />
            <Typography variant="body2">Anonymous peer chat</Typography>
          </Paper>
        )}

        {/* Floating volunteer chat widget: auto-opens assigned session */}
        {user?.role === 'volunteer' && assignedPeerChat?.sessionId && (
          <Paper
            elevation={6}
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              p: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer'
            }}
            onClick={() => navigate(`/peer-chat?sessionId=${assignedPeerChat.sessionId}`)}
          >
            <ForumIcon fontSize="small" />
            <Typography variant="body2">Anonymous student chat</Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default Layout;
