import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import DashboardLayout from './layouts/DashboardLayout';
import EmployeeLayout from './layouts/EmployeeLayout';

const Login = lazy(() => import('./pages/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminEmpleados = lazy(() => import('./pages/admin/Empleados'));
const AdminInformes = lazy(() => import('./pages/admin/Informes'));
const AdminConfiguracion = lazy(() => import('./pages/admin/Configuracion'));
const AdminMensajes = lazy(() => import('./pages/admin/Mensajes'));

const EmployeeMisTurnos = lazy(() => import('./pages/employee/MisTurnos'));
const EmployeeFichaje = lazy(() => import('./pages/employee/Fichaje'));
const EmployeeConfiguracion = lazy(() => import('./pages/employee/Configuracion'));
const EmployeeMensajes = lazy(() => import('./pages/employee/Mensajes'));

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

const PantallaDeCarga = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <p className="text-gray-500">Cargando...</p>
  </div>
);

export default function App() {
  return (
    <Router>
      <Suspense fallback={<PantallaDeCarga />}>
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
      </Suspense>
    </Router>
  );
}