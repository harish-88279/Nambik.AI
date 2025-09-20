import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Alert,
  Button,
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
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { useSocket } from '../context/SocketContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../services/api';
// user not used directly in ChatPage
import { useLocation } from 'react-router-dom';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [chatType, setChatType] = useState(null); // 'ai_chat', 'peer_chat', 'counselor_chat'
  const [availableSessions, setAvailableSessions] = useState([]);
  const [openSessionDialog, setOpenSessionDialog] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [availablePeers, setAvailablePeers] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState('');
  const messagesEndRef = useRef(null);
  const { socket } = useSocket();

  const location = useLocation();

  useEffect(() => {
    // Fetch available chat sessions for the user
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const [sessionsRes, peersRes] = await Promise.all([
          api.get('/chat/sessions'),
          api.get('/chat/peers/available'),
        ]);
        if (sessionsRes.data.success) {
          setAvailableSessions(sessionsRes.data.sessions);
        }
        if (peersRes.data.success) {
          setAvailablePeers(peersRes.data.peers);
        }
      } catch (error) {
        console.error('Error fetching sessions or peers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  // Auto-start chat based on URL query (?type=ai|peer)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get('type');
    // Only allow AI chat auto-start; peer chat moved to StudentPeerChatPage
    if (!sessionId && type === 'ai') {
      handleStartNewSession('ai_chat');
    }
  }, [location.search, sessionId]);

  useEffect(() => {
    if (socket && sessionId) {
      socket.emit('chat:join', { sessionId });

      socket.on('chat:message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      socket.on('crisis:alert', (alert) => {
        // Handle crisis alert
        console.log('Crisis alert received:', alert);
      });

      return () => {
        socket.off('chat:message');
        socket.off('crisis:alert');
      };
    }
  }, [socket, sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStartNewSession = async (type, peerId = null) => {
    setLoading(true);
    try {
      let response;
      if (type === 'ai_chat') {
        response = await api.post('/chat/sessions', { sessionType: 'ai_chat' });
      } else if (type === 'peer_chat') {
        if (!peerId) throw new Error('Please select a peer to start chat');
        response = await api.post('/chat/sessions/peer', { peerId });
      }
      if (response.data.success) {
        setSessionId(response.data.session.id);
        setChatType(type);
        setMessages([]); // Clear messages for new session
        setOpenSessionDialog(false);
      }
    } catch (error) {
      console.error('Error starting new session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinExistingSession = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/chat/sessions/${selectedSessionId}/messages`);
      if (response.data.success) {
        setMessages(response.data.messages);
        setSessionId(selectedSessionId);
        // Determine chat type based on session details (you might need to fetch session details)
        const sessionDetails = availableSessions.find(s => s.id === selectedSessionId);
        setChatType(sessionDetails?.session_type || 'ai_chat'); // Default to ai_chat if not found
        setOpenSessionDialog(false);
      }
    } catch (error) {
      console.error('Error joining session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !sessionId) return;

    const userMessage = {
      id: Date.now().toString(),
      senderType: 'user',
      messageText: newMessage,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');

    // Send message via socket
    if (socket) {
      socket.emit('chat:message', {
        sessionId,
        message: newMessage,
        senderType: 'user',
      });
    }

    // AI response is handled by the backend now
    if (chatType === 'ai_chat') {
      // No need for client-side AI response simulation
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageIcon = (senderType) => {
    switch (senderType) {
      case 'ai':
        return <BotIcon />;
      case 'counselor':
        return <PersonIcon />;
      case 'anonymous':
        return <GroupIcon />;
      default:
        return <PersonIcon />;
    }
  };

  const getMessageColor = (senderType) => {
    switch (senderType) {
      case 'ai':
        return 'primary';
      case 'counselor':
        return 'secondary';
      case 'anonymous':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading) {
    return <LoadingSpinner message="Starting chat session..." />;
  }

  return (
    <Box sx={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {chatType === 'ai_chat' && 'AI Mental Health Support Chat'}
          {chatType === 'peer_chat' && 'Anonymous Peer Chat'}
          {chatType === 'counselor_chat' && 'Counselor Chat'}
        </Typography>
        
        {chatType === 'ai_chat' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This is an AI-powered chat for mental health support. For immediate crisis help, please contact emergency services.
          </Alert>
        )}

        <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
          <List>
            {messages.map((message) => (
              <ListItem
                key={message.id}
                sx={{
                  flexDirection: message.senderType === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: `${getMessageColor(message.senderType)}.main` }}>
                    {getMessageIcon(message.senderType)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box>
                      <Typography
                        variant="body1"
                        sx={{
                          bgcolor: message.senderType === 'user' ? 'primary.light' : 'grey.100',
                          color: message.senderType === 'user' ? 'white' : 'text.primary',
                          p: 1.5,
                          borderRadius: 2,
                          maxWidth: '70%',
                          wordBreak: 'break-word',
                        }}
                      >
                        {message.messageText}
                      </Typography>
                      {message.isFlagged && (
                        <Chip
                          label="Flagged for Review"
                          color="warning"
                          size="small"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
            <div ref={messagesEndRef} />
          </List>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Type your message here..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!sessionId}
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !sessionId}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>

      <Dialog open={openSessionDialog} onClose={() => setOpenSessionDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Start or Join a Chat Session</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Start a New Session</Typography>
            <Button variant="contained" onClick={() => handleStartNewSession('ai_chat')} sx={{ mr: 2 }}>
              Start AI Chat
            </Button>
            <FormControl sx={{ minWidth: 240, mr: 2 }}>
              <InputLabel>Select Peer</InputLabel>
              <Select
                value={selectedPeer}
                onChange={(e) => setSelectedPeer(e.target.value)}
                label="Select Peer"
              >
                {availablePeers.map((peer) => (
                  <MenuItem key={peer.id} value={peer.id}>
                    {peer.first_name} {peer.last_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={() => selectedPeer && handleStartNewSession('peer_chat', selectedPeer)} disabled={!selectedPeer}>
              Start Peer Chat
            </Button>
          </Box>

          {availableSessions.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>Join Existing Session</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Select Session</InputLabel>
                <Select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  label="Select Session"
                >
                  {availableSessions.map((session) => (
                    <MenuItem key={session.id} value={session.id}>
                      {session.session_type === 'ai_chat' && `AI Chat - ${new Date(session.created_at).toLocaleString()}`}
                      {session.session_type === 'peer_chat' && `Peer Chat - ${new Date(session.created_at).toLocaleString()}`}
                      {session.session_type === 'counselor_chat' && `Counselor Chat - ${new Date(session.created_at).toLocaleString()}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" onClick={handleJoinExistingSession} disabled={!selectedSessionId}>
                Join Selected Session
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSessionDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatPage;