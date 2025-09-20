import React from 'react';
import Dashboard from '../Dashboard';

// Minimal AdminLayout that re-uses the existing Dashboard component.
// This keeps the current admin UX while providing a dedicated layout file
// that can be expanded later to include nested <Outlet /> routes if desired.
const AdminLayout = () => {
  return <Dashboard />;
};

export default AdminLayout;
