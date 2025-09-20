import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [assignedPeerChat, setAssignedPeerChat] = useState(null); // { sessionId, studentId, createdAt }
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('authToken');
      const newSocket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000', {
        auth: {
          token,
        },
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      // When a student assigns a peer chat to this volunteer
      newSocket.on('peerChat:assigned', (payload) => {
        // payload: { sessionId, studentId, language, createdAt }
        setAssignedPeerChat(payload);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user]);

  const value = {
    socket,
    isConnected,
    assignedPeerChat,
    clearAssignedPeerChat: () => setAssignedPeerChat(null),
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
