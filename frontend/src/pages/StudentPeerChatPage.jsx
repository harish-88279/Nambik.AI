import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ListItemButton,
  Divider,
  Snackbar,
  Alert,
  InputAdornment,
} from '@mui/material';
import {
  Send as SendIcon,
  Search as SearchIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useSocket } from '../context/SocketContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

// Normalize message shape from API/socket into a consistent UI format
function normalizeMessage(m) {
  return {
    id: m.id || m._id || `${m.created_at || m.createdAt}-${Math.random()}`,
    senderType: m.senderType || m.sender_type || 'user',
    messageText: m.messageText || m.message_text || m.text || '',
    createdAt: m.createdAt || m.created_at || new Date().toISOString(),
    isFlagged: m.isFlagged || m.is_flagged || false,
    sessionId: m.sessionId || m.session_id,
  };
}

const StudentPeerChatPage = () => {
  // user is available via context; keep call for potential use in UI
  useAuth();
  const { socket } = useSocket();

  // Demo peers and messages to display without backend
  const demoPeers = [
    { id: 'p1', first_name: 'Ravi', last_name: 'K', institution_name: 'College A' },
    { id: 'p2', first_name: 'Sara', last_name: 'L', institution_name: 'College B' },
  ];
  const [peers] = useState(demoPeers);
  const [search, setSearch] = useState('');
  const [selectedPeer, setSelectedPeer] = useState(null);

  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarText, setSnackbarText] = useState('');

  const messagesEndRef = useRef(null);

  // Load available peers
  // demo peers are already set above

  // Join socket room and listen for incoming messages
  useEffect(() => {
    if (!socket || !sessionId) return;

    socket.emit('chat:join', { sessionId }); // ensure real-time room join for immediate delivery

    const onIncoming = (msg) => {
      const normalized = normalizeMessage(msg);
      // If server doesn't tag session, still accept for active chat
      if (!normalized.sessionId || normalized.sessionId === sessionId) {
        setMessages((prev) => [...prev, normalized]);
        setSnackbarText('New message received');
        setSnackbarOpen(true);
      }
    };

    socket.on('chat:message', onIncoming);

    return () => {
      socket.off('chat:message', onIncoming);
    };
  }, [socket, sessionId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start or get existing session with a peer, then load messages
  const startPeerSession = async (peer) => {
    // create a demo conversation
    setSelectedPeer(peer);
    const demoSessionId = `session-${peer.id}`;
    setSessionId(demoSessionId);
    const demoMessages = [
      { id: `${demoSessionId}-m1`, senderType: 'user', messageText: `Hi ${peer.first_name}, want to chat?`, createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
      { id: `${demoSessionId}-m2`, senderType: 'peer', messageText: `Sure, I'm available now.`, createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
    ];
    setMessages(demoMessages);
  };

  const handleSend = () => {
    if (!newMessage.trim() || !sessionId) return;
    const outgoing = normalizeMessage({
      sender_type: 'user',
      message_text: newMessage,
      created_at: new Date().toISOString(),
      session_id: sessionId,
    });
    setMessages((prev) => [...prev, outgoing]);
    setNewMessage('');
    if (socket) {
      socket.emit('chat:message', {
        sessionId,
        message: outgoing.messageText,
        senderType: 'user',
      });
    }
  };

  const filteredPeers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return peers;
    return peers.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(term));
  }, [peers, search]);

  if (peers.length === 0 && !selectedPeer) {
    return <LoadingSpinner message="Loading peers..." />;
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 200px)' }}>
      {/* Left: Peers list */}
      <Paper sx={{ width: 320, mr: 2, p: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" sx={{ p: 1 }}>Peers</Typography>
        <TextField
          size="small"
          placeholder="Search peers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ m: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Divider sx={{ my: 1 }} />
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          <List dense>
            {filteredPeers.map((peer) => (
              <ListItem key={peer.id} disablePadding>
                <ListItemButton
                  selected={selectedPeer?.id === peer.id}
                  onClick={() => startPeerSession(peer)}
                >
                  <ListItemAvatar>
                    <Avatar>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${peer.first_name} ${peer.last_name}`}
                    secondary={peer.institution_name || 'Peer'}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Paper>

      {/* Right: Chat area */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        {!selectedPeer ? (
          <Typography color="text.secondary">Select a peer to start chatting.</Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ mr: 1 }}><PersonIcon /></Avatar>
              <Typography variant="h6">
                Chat with {selectedPeer.first_name} {selectedPeer.last_name}
              </Typography>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
              <List>
                {messages.map((m) => (
                  <ListItem
                    key={`${m.id}-${m.createdAt}`}
                    sx={{
                      flexDirection: m.senderType === 'user' ? 'row-reverse' : 'row',
                      alignItems: 'flex-start',
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: m.senderType === 'user' ? 'primary.main' : 'info.main' }}>
                        <PersonIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box>
                          <Typography
                            variant="body1"
                            sx={{
                              bgcolor: m.senderType === 'user' ? 'primary.light' : 'grey.100',
                              color: m.senderType === 'user' ? 'white' : 'text.primary',
                              p: 1.5,
                              borderRadius: 2,
                              maxWidth: '70%',
                              wordBreak: 'break-word',
                            }}
                          >
                            {m.messageText}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {new Date(m.createdAt).toLocaleTimeString()}
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
              <IconButton color="primary" onClick={handleSend} disabled={!newMessage.trim() || !sessionId}>
                <SendIcon />
              </IconButton>
            </Box>
          </>
        )}
      </Paper>

      <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity="info" sx={{ width: '100%' }}>
          {snackbarText}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StudentPeerChatPage;