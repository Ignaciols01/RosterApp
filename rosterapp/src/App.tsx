import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import DashboardLayout from './layouts/DashboardLayout';
import EmployeeLayout from './layouts/EmployeeLayout';

import Login from './pages/Login';
import NotFound from './pages/NotFound';

import AdminDashboard from './pages/admin/Dashboard';
import AdminEmpleados from './pages/admin/Empleados';
import AdminInformes from './pages/admin/Informes';
import AdminConfiguracion from './pages/admin/Configuracion';
import AdminMensajes from './pages/admin/Mensajes';

import EmployeeMisTurnos from './pages/employee/MisTurnos';
import EmployeeFichaje from './pages/employee/Fichaje';
import EmployeeConfiguracion from './pages/employee/Configuracion';
import EmployeeMensajes from './pages/employee/Mensajes';

// Inicialización de Modo Oscuro al arrancar la app
if (localStorage.getItem('rosterapp_theme') === 'dark') {
  document.documentElement.classList.add('dark');
}

const ProtectedRoute = ({ children, allowedRole }: { children: React.ReactNode, allowedRole: string }) => {
  const userDataString = localStorage.getItem('rosterapp_user');
  
  if (!userDataString) return <Navigate to="/" replace />;

  const user = JSON.parse(userDataString);
  
  if (user.rol !== allowedRole) {
    return user.rol === 'administrador' 
      ? <Navigate to="/admin/dashboard" replace /> 
      : <Navigate to="/empleado/turnos" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* ZONA ADMIN */}
        <Route path="/admin" element={<ProtectedRoute allowedRole="administrador"><DashboardLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="empleados" element={<AdminEmpleados />} />
          <Route path="informes" element={<AdminInformes />} />
          <Route path="mensajes" element={<AdminMensajes />} />
          <Route path="configuracion" element={<AdminConfiguracion />} />
        </Route>

        {/* ZONA EMPLEADO */}
        <Route path="/empleado" element={<ProtectedRoute allowedRole="empleado"><EmployeeLayout /></ProtectedRoute>}>
          <Route path="turnos" element={<EmployeeMisTurnos />} />
          <Route path="fichaje" element={<EmployeeFichaje />} />
          <Route path="mensajes" element={<EmployeeMensajes />} />
          <Route path="configuracion" element={<EmployeeConfiguracion />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}