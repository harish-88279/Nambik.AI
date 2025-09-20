import React, { useEffect, useRef, useState } from 'react';
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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useSocket } from '../context/SocketContext';
// navigate not used in this page
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../services/api';

const PeerChatPage = () => {
  const { socket, assignedPeerChat, clearAssignedPeerChat } = useSocket();
  const [loading] = useState(false);
  const [assignedSessions, setAssignedSessions] = useState([
    { id: 's1', created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), peerName: 'Asha P' },
    { id: 's2', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), peerName: 'Vikram S' },
  ]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // assignedSessions are hard-coded for demo mode

  // Auto-open session when navigated with ?sessionId=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('sessionId');
    if (sid) {
      setSelectedSessionId(sid);
      (async () => {
        await loadMessages(sid);
      })();
    }
  }, []);

  // If a new assignment arrives via socket, navigate into it
  useEffect(() => {
    if (assignedPeerChat?.sessionId) {
      const sid = assignedPeerChat.sessionId;
      setSelectedSessionId(sid);
      (async () => {
        await loadMessages(sid);
      })();
      // Clear the notification state
      clearAssignedPeerChat();
      // Also push sessionId in URL for refresh safety
      const url = new URL(window.location.href);
      url.searchParams.set('sessionId', sid);
      window.history.replaceState({}, '', url.toString());
    }
  }, [assignedPeerChat, clearAssignedPeerChat]);

  useEffect(() => {
    if (socket && selectedSessionId) {
      socket.emit('chat:join', { sessionId: selectedSessionId });
      socket.on('chat:message', (message) => {
        if (message.session_id === selectedSessionId) {
          setMessages(prev => [...prev, message]);
        } else {
          setMessages(prev => [...prev, message]); // if backend doesn't include session_id, still append
        }
      });
      return () => {
        socket.off('chat:message');
      };
    }
  }, [socket, selectedSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async (sessionId) => {
    // demo messages per session
    const demo = {
      s1: [
        { id: 's1-1', sender_type: 'user', message_text: 'Hello, I need to talk about a recent incident.', created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString() },
        { id: 's1-2', sender_type: 'counselor', message_text: 'I am here to listen. Tell me what happened.', created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString() },
      ],
      s2: [
        { id: 's2-1', sender_type: 'user', message_text: 'I have trouble sleeping before exams.', created_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString() },
      ],
    };
    setMessages(demo[sessionId] || []);
  };

  const handleSelectSession = async (id) => {
    setSelectedSessionId(id);
    await loadMessages(id);
  };

  const handleSend = () => {
    if (!newMessage.trim() || !selectedSessionId) return;
    const outgoing = {
      id: Date.now().toString(),
      sender_type: 'counselor',
      message_text: newMessage,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, outgoing]);
    setNewMessage('');
    if (socket) {
      socket.emit('chat:message', {
        sessionId: selectedSessionId,
        message: outgoing.message_text,
        senderType: 'counselor',
      });
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading assigned peer chats..." />;
  }

  return (
    <Box sx={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 260 }}>
          <InputLabel>Select Assigned Session</InputLabel>
          <Select
            value={selectedSessionId}
            onChange={(e) => handleSelectSession(e.target.value)}
            label="Select Assigned Session"
          >
            {assignedSessions.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                Peer Chat • {new Date(s.created_at).toLocaleString()}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="outlined" onClick={async () => {
          // refresh assigned
          try {
            const res = await api.get('/chat/sessions/assigned');
            if (res.data.success) setAssignedSessions(res.data.sessions);
          } catch {}
        }}>Refresh</Button>
      </Box>

      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        {!selectedSessionId ? (
          <Typography color="text.secondary">Select a session to start chatting.</Typography>
        ) : (
          <>
            <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
              <List>
                {messages.map((m) => (
                  <ListItem
                    key={`${m.id}-${m.created_at}`}
                    sx={{
                      flexDirection: m.sender_type === 'counselor' ? 'row-reverse' : 'row',
                      alignItems: 'flex-start',
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: m.sender_type === 'counselor' ? 'secondary.main' : 'info.main' }}>
                        <PersonIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box>
                          <Typography
                            variant="body1"
                            sx={{
                              bgcolor: m.sender_type === 'counselor' ? 'secondary.light' : 'grey.100',
                              color: m.sender_type === 'counselor' ? 'white' : 'text.primary',
                              p: 1.5,
                              borderRadius: 2,
                              maxWidth: '70%',
                              wordBreak: 'break-word',
                            }}
                          >
                            {m.message_text}
                          </Typography>
                          {m.is_flagged && (
                            <Chip label="Flagged" color="warning" size="small" sx={{ mt: 1 }} />
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {new Date(m.created_at).toLocaleTimeString()}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <IconButton color="primary" onClick={handleSend} disabled={!newMessage.trim()}>
                <SendIcon />
              </IconButton>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default PeerChatPage;