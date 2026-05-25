import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [nombreUsuario, setNombreUsuario] = useState('Admin');
  const [iniciales, setIniciales] = useState('AD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mensajesSinLeer, setMensajesSinLeer] = useState(0);

  useEffect(() => {
    const cargarDatos = () => {
      const userDataString = localStorage.getItem('rosterapp_user');
      if (userDataString) {
        const user = JSON.parse(userDataString);
        const nombreReal = user.nombre || 'Admin';
        setNombreUsuario(nombreReal);
        setIniciales(nombreReal.substring(0, 2).toUpperCase());
        setAvatar(localStorage.getItem(`rosterapp_avatar_${user.id}`));
      }
    };
    cargarDatos();

    // Comprobar mensajes sin leer
    const fetchMensajesBadge = async () => {
      const user = JSON.parse(localStorage.getItem('rosterapp_user') || '{}');
      const miId = user.id_usuario || user.id;
      if (!miId) return;
      
      const { count } = await supabase
        .from('mensajes')
        .select('*', { count: 'exact', head: true })
        .eq('receptor_id', miId)
        .eq('leido', false);
      setMensajesSinLeer(count || 0);
    };
    
    fetchMensajesBadge();
    const badgeInterval = setInterval(fetchMensajesBadge, 10000);

    const handleAvatarUpdate = () => {
      const user = JSON.parse(localStorage.getItem('rosterapp_user') || '{}');
      if (user.id) setAvatar(localStorage.getItem(`rosterapp_avatar_${user.id}`));
    };
    const handleNameUpdate = () => cargarDatos();
    
    window.addEventListener('employeeAvatarUpdated', handleAvatarUpdate);
    window.addEventListener('employeeNameUpdated', handleNameUpdate);
    
    return () => {
      window.removeEventListener('employeeAvatarUpdated', handleAvatarUpdate);
      window.removeEventListener('employeeNameUpdated', handleNameUpdate);
      clearInterval(badgeInterval);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('rosterapp_user');
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0b1120] transition-colors duration-300 font-sans print:h-auto print:bg-white overflow-hidden">
      
      {/* CABECERA MÓVIL */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-[#0f172a] border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-4 z-40 print:hidden shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-lg font-extrabold text-blue-700 dark:text-blue-400 tracking-tight transition-colors duration-300">RosterApp</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          aria-label={isMobileMenuOpen ? "Cerrar menú móvil" : "Abrir menú móvil"}
          className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors duration-300"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
          {!isMobileMenuOpen && mensajesSinLeer > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5 bg-red-500 rounded-full border border-white dark:border-[#0f172a]"></span>
          )}
        </button>
      </div>

      {/* FONDO OSCURO PARA MÓVIL */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* BARRA LATERAL (SIDEBAR) */}
      <aside className={`
        fixed md:static top-0 left-0 h-full w-64 bg-white dark:bg-[#0f172a] border-r border-gray-200 dark:border-slate-800 flex flex-col transition-all duration-300 z-50 print:hidden
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        
        {/* LOGO ESCRITORIO */}
        <div className="hidden md:flex p-6 border-b border-gray-200 dark:border-slate-800 items-center gap-3 transition-colors duration-300">
           <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          <h1 className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 tracking-tight transition-colors duration-300">RosterApp</h1>
        </div>

        {/* LOGO MÓVIL */}
        <div className="md:hidden p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center transition-colors duration-300">
          <span className="font-extrabold text-slate-800 dark:text-white transition-colors duration-300">Menú</span>
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            aria-label="Cerrar menú móvil"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors duration-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* NAVEGACIÓN */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto hide-scrollbar">
          <p className="px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 mt-4 md:mt-0 transition-colors duration-300">Gestión</p>
          
          <NavLink to="/admin/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-blue-700 dark:hover:text-slate-200'}`}>
            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Calendario
          </NavLink>
          <NavLink to="/admin/empleados" onClick={() => setIsMobileMenuOpen(false)} className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-blue-700 dark:hover:text-slate-200'}`}>
            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Empleados
          </NavLink>
          <NavLink to="/admin/informes" onClick={() => setIsMobileMenuOpen(false)} className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-blue-700 dark:hover:text-slate-200'}`}>
            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Informes
          </NavLink>
          <NavLink to="/admin/mensajes" onClick={() => setIsMobileMenuOpen(false)} className={({isActive}) => `flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-blue-700 dark:hover:text-slate-200'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Mensajes
            </div>
            {mensajesSinLeer > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">{mensajesSinLeer}</span>
            )}
          </NavLink>
          <NavLink to="/admin/configuracion" onClick={() => setIsMobileMenuOpen(false)} className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-blue-700 dark:hover:text-slate-200'}`}>
            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            Configuración
          </NavLink>
        </nav>

        {/* PERFIL INFERIOR */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-800 transition-colors duration-300">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex items-center gap-3 border border-gray-200 dark:border-slate-700 mb-3 shadow-sm transition-colors duration-300">
            {avatar ? (
              <img src={avatar} alt="Perfil" className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm flex-shrink-0 transition-colors duration-300" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm border-2 border-white dark:border-slate-700 flex-shrink-0 transition-colors duration-300">
                {iniciales}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">Conectado como</p>
              <p className="text-sm font-bold text-slate-800 dark:text-white truncate transition-colors duration-300">{nombreUsuario}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout} 
            aria-label="Cerrar Sesión"
            className="w-full text-center py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-lg transition-colors duration-300 cursor-pointer uppercase tracking-wider"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto mt-16 md:mt-0 print:overflow-visible relative z-0 transition-colors duration-300">
        <Outlet />
      </main>
      
    </div>
  );
}