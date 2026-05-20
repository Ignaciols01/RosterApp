import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Configuracion() {
  const [activeTab, setActiveTab] = useState<'perfil' | 'seguridad' | 'preferencias'>('perfil');
  const user = JSON.parse(localStorage.getItem('rosterapp_user') || '{}');
  
  // ================= PERFIL Y AVATAR =================
  const [avatarUrl, setAvatarUrl] = useState<string | null>(localStorage.getItem(`rosterapp_avatar_${user.id}`));
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [mensajePerfil, setMensajePerfil] = useState<{texto: string, tipo: 'error' | 'exito'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNombre(user.nombre || 'Empleado');
    setCorreo(user.email || 'correo@empresa.com');
  }, [user.nombre, user.email]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64Reducida = canvas.toDataURL('image/jpeg', 0.8);
        setAvatarUrl(base64Reducida);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleBorrarAvatar = () => {
    setAvatarUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGuardarPerfil = async () => {
    setMensajePerfil(null);
    if (!user.id) return;

    const { error } = await supabase
      .from('usuarios')
      .update({ nombre: nombre })
      .eq('id_usuario', user.id);

    if (error) {
      setMensajePerfil({ texto: 'Error al guardar el perfil en la base de datos.', tipo: 'error' });
    } else {
      user.nombre = nombre;
      localStorage.setItem('rosterapp_user', JSON.stringify(user));
      
      if (avatarUrl) {
        localStorage.setItem(`rosterapp_avatar_${user.id}`, avatarUrl);
      } else {
        localStorage.removeItem(`rosterapp_avatar_${user.id}`);
      }
      
      window.dispatchEvent(new Event('employeeAvatarUpdated'));
      window.dispatchEvent(new Event('employeeNameUpdated'));

      setMensajePerfil({ texto: '¡Perfil actualizado correctamente!', tipo: 'exito' });
    }
  };

  // ================= SEGURIDAD =================
  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [repetirPassword, setRepetirPassword] = useState('');
  const [mensajeSeguridad, setMensajeSeguridad] = useState<{texto: string, tipo: 'error' | 'exito'} | null>(null);

  const handleActualizarPassword = async () => {
    setMensajeSeguridad(null);
    if (nuevaPassword !== repetirPassword) {
      setMensajeSeguridad({ texto: 'Las contraseñas nuevas no coinciden.', tipo: 'error' });
      return;
    }

    if (!user.id) return;

    const { data: usuarioData, error: errorBusqueda } = await supabase
      .from('usuarios')
      .select('password')
      .eq('id_usuario', user.id)
      .single();

    if (errorBusqueda || usuarioData?.password !== passwordActual) {
      setMensajeSeguridad({ texto: 'La contraseña actual es incorrecta.', tipo: 'error' });
      return;
    }

    const { error: errorUpdate } = await supabase
      .from('usuarios')
      .update({ password: nuevaPassword })
      .eq('id_usuario', user.id);

    if (errorUpdate) {
      setMensajeSeguridad({ texto: 'Error al conectar con la base de datos.', tipo: 'error' });
    } else {
      setMensajeSeguridad({ texto: '¡Contraseña actualizada con éxito!', tipo: 'exito' });
      setPasswordActual('');
      setNuevaPassword('');
      setRepetirPassword('');
    }
  };

  // ================= PREFERENCIAS =================
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('rosterapp_theme') === 'dark';
  });

  // EFECTO QUE GARANTIZA LA SINCRONIZACIÓN AL CARGAR LA PÁGINA (F5)
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('rosterapp_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('rosterapp_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // NUEVO: Estado para el interruptor de correos
  const [notificaciones, setNotificaciones] = useState(true);

  // NUEVO: Leer preferencia de Supabase al cargar
  useEffect(() => {
    async function cargarPreferenciasCorreos() {
      if (!user.id) return;
      const { data, error } = await supabase
        .from('usuarios')
        .select('recibir_correos')
        .eq('id_usuario', user.id)
        .single();
        
      if (data && !error) {
        setNotificaciones(data.recibir_correos);
      }
    }
    cargarPreferenciasCorreos();
  }, [user.id]);

  // NUEVO: Guardar en Supabase al hacer clic
  const handleToggleNotificaciones = async () => {
    const nuevoEstado = !notificaciones;
    setNotificaciones(nuevoEstado); // Cambiamos la vista inmediatamente

    if (!user.id) return;

    const { error } = await supabase
      .from('usuarios')
      .update({ recibir_correos: nuevoEstado })
      .eq('id_usuario', user.id);

    if (error) {
      console.error("Error al guardar preferencia:", error);
      setNotificaciones(!nuevoEstado); // Revertimos si hay error
    }
  };

  return (
    <div className="bg-transparent transition-colors duration-300">
      
      <header className="bg-blue-700 dark:bg-blue-900 text-white p-5 md:p-6 shadow-sm rounded-xl mb-4 md:mb-6 transition-colors duration-300">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight mb-1">Configuración de Cuenta</h1>
        <p className="text-blue-200 dark:text-blue-300 text-xs md:text-sm font-medium">Gestiona tu información personal y las preferencias del sistema</p>
      </header>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row overflow-hidden min-h-[500px] transition-colors duration-300">
        
        <div className="w-full md:w-64 bg-gray-50 dark:bg-slate-800/50 border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700 p-4 md:p-6">
          <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 hide-scrollbar">
            <button onClick={() => setActiveTab('perfil')} className={`flex-shrink-0 w-auto md:w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${activeTab === 'perfil' ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm border border-gray-100 dark:border-slate-600' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-gray-100'}`}>Mi Perfil</button>
            <button onClick={() => setActiveTab('seguridad')} className={`flex-shrink-0 w-auto md:w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${activeTab === 'seguridad' ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm border border-gray-100 dark:border-slate-600' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-gray-100'}`}>Seguridad</button>
            <button onClick={() => setActiveTab('preferencias')} className={`flex-shrink-0 w-auto md:w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${activeTab === 'preferencias' ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm border border-gray-100 dark:border-slate-600' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-gray-100'}`}>Preferencias</button>
          </nav>
        </div>

        <div className="flex-1 p-5 md:p-8">
          
          {/* MI PERFIL */}
          {activeTab === 'perfil' && (
            <div className="animate-fade-in">
              <h3 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">Información Personal</h3>
              
              {mensajePerfil && (
                <div className={`mb-6 p-3 rounded-lg text-sm font-bold border-l-4 ${mensajePerfil.tipo === 'error' ? 'bg-red-50 text-red-700 border-red-500' : 'bg-emerald-50 text-emerald-700 border-emerald-500'}`}>
                  {mensajePerfil.texto}
                </div>
              )}

              <div className="bg-blue-50/50 dark:bg-slate-700/50 rounded-xl p-5 flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 border border-blue-100 dark:border-slate-600 mb-8 text-center sm:text-left">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover shadow-sm border-2 border-blue-200 dark:border-slate-500 flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600 dark:bg-blue-500 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-extrabold shadow-sm flex-shrink-0">
                    {nombre.substring(0,2).toUpperCase()}
                  </div>
                )}
                
                <div>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" />
                  
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-2">
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 font-bold py-2 px-4 rounded-lg shadow-sm hover:border-blue-300 dark:hover:border-blue-500 transition-colors text-xs md:text-sm cursor-pointer">
                      Cambiar Avatar
                    </button>
                    
                    {avatarUrl && (
                      <button onClick={handleBorrarAvatar} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 font-bold py-2 px-4 rounded-lg shadow-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-xs md:text-sm cursor-pointer">
                        Borrar
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 font-medium">Se redimensionará automáticamente.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Nombre (Visual)</label>
                  <input 
                    type="text" 
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 shadow-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Correo Electrónico (Solo Lectura)</label>
                  <input 
                    type="email" 
                    readOnly
                    value={correo}
                    className="w-full border border-gray-200 dark:border-slate-600 bg-gray-100 dark:bg-slate-900 rounded-lg px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed shadow-sm transition-all"
                  />
                </div>
              </div>

              <button 
                onClick={handleGuardarPerfil}
                className="w-full md:w-auto bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-bold py-2.5 md:py-3 px-6 rounded-lg shadow-md transition-colors cursor-pointer text-sm"
              >
                Guardar Cambios
              </button>
            </div>
          )}

          {/* SEGURIDAD */}
          {activeTab === 'seguridad' && (
            <div className="animate-fade-in">
              <h3 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">Seguridad y Contraseña</h3>
              
              <div className="max-w-md space-y-4">
                {mensajeSeguridad && (
                  <div className={`p-3 rounded-lg text-sm font-bold border-l-4 ${mensajeSeguridad.tipo === 'error' ? 'bg-red-50 text-red-700 border-red-500' : 'bg-emerald-50 text-emerald-700 border-emerald-500'}`}>
                    {mensajeSeguridad.texto}
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Contraseña Actual</label>
                  <input type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} placeholder="••••••••" className="w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 shadow-sm transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Nueva Contraseña</label>
                  <input type="password" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} placeholder="••••••••" className="w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 shadow-sm transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Repetir Nueva Contraseña</label>
                  <input type="password" value={repetirPassword} onChange={(e) => setRepetirPassword(e.target.value)} placeholder="••••••••" className="w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 shadow-sm transition-all" />
                </div>
                
                <button onClick={handleActualizarPassword} className="mt-6 w-full md:w-auto bg-gray-800 dark:bg-slate-700 hover:bg-gray-900 dark:hover:bg-slate-600 text-white font-bold py-2.5 md:py-3 px-6 rounded-lg shadow-md transition-colors cursor-pointer text-sm">
                  Actualizar Contraseña
                </button>
              </div>
            </div>
          )}

          {/* PREFERENCIAS */}
          {activeTab === 'preferencias' && (
            <div className="animate-fade-in">
              <h3 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">Preferencias del Sistema</h3>
              
              <div className="space-y-4 max-w-2xl">
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm transition-colors duration-300 gap-4">
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">Notificaciones por Correo</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Recibe un aviso cuando se te asigne o modifique un turno.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input type="checkbox" className="sr-only peer" checked={notificaciones} onChange={handleToggleNotificaciones} />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm transition-colors duration-300 gap-4">
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">Modo Oscuro</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Cambia la interfaz a colores oscuros para descansar la vista.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input type="checkbox" className="sr-only peer" checked={isDarkMode} onChange={toggleDarkMode} />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                  </label>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}