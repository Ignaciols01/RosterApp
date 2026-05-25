import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function EmployeeLayout() {
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [mensajesSinLeer, setMensajesSinLeer] = useState(0);

  useEffect(() => {
    const cargarDatos = () => {
      const userDataString = localStorage.getItem('rosterapp_user');
      if (userDataString) {
        const user = JSON.parse(userDataString);
        setNombreUsuario(user.nombre || 'Empleado');
        setAvatar(localStorage.getItem(`rosterapp_avatar_${user.id}`));
        
        fetchNotificaciones(user.id);
      } else {
        navigate('/');
      }
    };

    cargarDatos();

    const handleAvatarUpdate = () => {
      const user = JSON.parse(localStorage.getItem('rosterapp_user') || '{}');
      if (user.id) setAvatar(localStorage.getItem(`rosterapp_avatar_${user.id}`));
    };
    const handleNameUpdate = () => {
      cargarDatos();
    };
    
    window.addEventListener('employeeAvatarUpdated', handleAvatarUpdate);
    window.addEventListener('employeeNameUpdated', handleNameUpdate);
    
    const user = JSON.parse(localStorage.getItem('rosterapp_user') || '{}');
    const notifInterval = setInterval(async () => {
      if (user.id) {
        fetchNotificaciones(user.id);
        
        // Refrescar el número de mensajes
        const miId = user.id_usuario || user.id;
        const { count } = await supabase
          .from('mensajes')
          .select('*', { count: 'exact', head: true })
          .eq('receptor_id', miId)
          .eq('leido', false);
        setMensajesSinLeer(count || 0);
      }
    }, 10000);

    return () => {
      window.removeEventListener('employeeAvatarUpdated', handleAvatarUpdate);
      window.removeEventListener('employeeNameUpdated', handleNameUpdate);
      clearInterval(notifInterval);
    };
  }, [navigate]);

  const fetchNotificaciones = async (userId: string) => {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('id_usuario', userId)
      .eq('leida', false)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setNotificaciones(data);
    }
  };

  const marcarComoLeida = async (id: string) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id_notificacion', id);
    setNotificaciones(prev => prev.filter(n => n.id_notificacion !== id));
  };

  const handleLogout = () => {
    localStorage.removeItem('rosterapp_user');
    navigate('/');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] dark:bg-[#0b1120] transition-colors duration-300 font-sans">
      
      <header className="bg-white dark:bg-[#0f172a] border-b border-gray-200 dark:border-slate-800/80 flex items-center justify-between px-4 md:px-8 py-3 shadow-sm md:shadow-md z-40 relative transition-colors duration-300">
        
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xl font-extrabold text-blue-700 dark:text-blue-400 tracking-tight">RosterApp</span>
          </div>

          <nav className="hidden md:flex items-center gap-2">
            <NavLink to="/empleado/fichaje" className={({isActive}) => `px-4 py-2 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>Fichar</NavLink>
            <NavLink to="/empleado/turnos" className={({isActive}) => `px-4 py-2 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>Mis Turnos</NavLink>
            
            <NavLink to="/empleado/mensajes" className={({isActive}) => `relative px-4 py-2 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
              Mensajes
              {mensajesSinLeer > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-sm ring-2 ring-white dark:ring-[#0f172a]">{mensajesSinLeer}</span>
              )}
            </NavLink>
            
            <NavLink to="/empleado/configuracion" className={({isActive}) => `px-4 py-2 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>Configuración</NavLink>
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <div className="relative">
            <button 
              onClick={() => setShowNotifPanel(!showNotifPanel)} 
              aria-label="Ver notificaciones"
              className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors cursor-pointer bg-slate-100 dark:bg-slate-800/50 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              {notificaciones.length > 0 && (
                <span className="absolute top-1 right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white dark:border-[#0f172a]"></span>
                </span>
              )}
            </button>

            {showNotifPanel && (
               <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden z-50 animate-fade-in origin-top-right">
                  <div className="bg-slate-50 dark:bg-slate-900/80 p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                     <h3 className="text-slate-800 dark:text-white font-bold text-sm">Notificaciones</h3>
                     {notificaciones.length > 0 && <span className="bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 text-[10px] px-2 py-1 rounded-lg font-bold">{notificaciones.length} nuevas</span>}
                  </div>
                  <div className="max-h-80 overflow-y-auto hide-scrollbar">
                     {notificaciones.length > 0 ? (
                       notificaciones.map(n => (
                         <div key={n.id_notificacion} className="p-4 border-b border-gray-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                           <div className="flex items-start gap-3">
                             <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ${n.titulo.toLowerCase().includes('aprobado') ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'}`}></div>
                             <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight mb-1.5">{n.titulo}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{n.mensaje}</p>
                                <button 
                                  onClick={() => marcarComoLeida(n.id_notificacion)} 
                                  aria-label={`Marcar notificación como leída: ${n.titulo}`}
                                  className="mt-3 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer w-full text-center"
                                >
                                  Entendido (Marcar leída)
                                </button>
                             </div>
                           </div>
                         </div>
                       ))
                     ) : (
                       <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm font-medium flex flex-col items-center">
                         <svg className="w-8 h-8 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                         Estás al día. No hay avisos.
                       </div>
                     )}
                  </div>
               </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800 dark:text-white">Hola, {nombreUsuario}</span>
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm border-2 border-white dark:border-slate-700">
                {nombreUsuario.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          
          <button 
            onClick={handleLogout} 
            aria-label="Cerrar Sesión"
            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-xl transition-colors cursor-pointer" 
            title="Cerrar Sesión"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          </button>
        </div>

        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          aria-label={isMobileMenuOpen ? "Cerrar menú móvil" : "Abrir menú móvil"}
          className="md:hidden relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             {isMobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />}
           </svg>
           {!isMobileMenuOpen && (notificaciones.length > 0 || mensajesSinLeer > 0) && (
              <span className="absolute top-2 right-2 flex h-2.5 w-2.5 bg-red-500 rounded-full border border-white dark:border-[#0f172a]"></span>
           )}
        </button>
      </header>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-[#0f172a] border-b border-gray-200 dark:border-slate-800 p-4 animate-fade-in z-30 relative shadow-xl">
           
           <div className="mb-4 pb-4 border-b border-gray-100 dark:border-slate-800">
              <div className="flex justify-between items-center mb-3">
                 <span className="text-slate-800 dark:text-white font-bold text-sm">Notificaciones ({notificaciones.length})</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                 {notificaciones.length > 0 ? notificaciones.map(n => (
                    <div key={n.id_notificacion} className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-lg border border-gray-200 dark:border-slate-700/50">
                       <p className={`text-xs font-bold mb-1 ${n.titulo.toLowerCase().includes('aprobado') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{n.titulo}</p>
                       <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-tight mb-3">{n.mensaje}</p>
                       <button 
                         onClick={() => marcarComoLeida(n.id_notificacion)} 
                         aria-label={`Descartar notificación: ${n.titulo}`}
                         className="w-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 py-1.5 rounded font-bold uppercase tracking-wider"
                       >
                         Descartar
                       </button>
                    </div>
                 )) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">No hay avisos nuevos.</p>
                 )}
              </div>
           </div>

           <nav className="flex flex-col gap-2">
            <NavLink to="/empleado/fichaje" onClick={() => setIsMobileMenuOpen(false)} className={({isActive}) => `px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>Fichar</NavLink>
            <NavLink to="/empleado/turnos" onClick={() => setIsMobileMenuOpen(false)} className={({isActive}) => `px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>Mis Turnos</NavLink>
            
            <NavLink to="/empleado/mensajes" onClick={() => setIsMobileMenuOpen(false)} className={({isActive}) => `flex justify-between items-center px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
              Mensajes
              {mensajesSinLeer > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{mensajesSinLeer}</span>}
            </NavLink>

            <NavLink to="/empleado/configuracion" onClick={() => setIsMobileMenuOpen(false)} className={({isActive}) => `px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>Configuración</NavLink>
            <button 
              onClick={handleLogout} 
              aria-label="Cerrar Sesión"
              className="text-left px-4 py-3 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 mt-2 border-t border-gray-100 dark:border-slate-800"
            >
              Cerrar Sesión
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 w-full relative z-0">
        <Outlet />
      </main>
    </div>
  );
}