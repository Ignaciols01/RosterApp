import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface Usuario {
  id_usuario: string;
  nombre: string;
  email: string;
}

interface Mensaje {
  id_mensaje: string;
  emisor_id: string;
  receptor_id: string;
  contenido: string;
  fecha_envio: string;
  leido: boolean;
}

export default function AdminMensajes() {
  const user = JSON.parse(localStorage.getItem('rosterapp_user') || '{}');
  const miId = user.id_usuario || user.id; 
  
  const [empleados, setEmpleados] = useState<Usuario[]>([]);
  const [contactoActivo, setContactoActivo] = useState<Usuario | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [sinLeer, setSinLeer] = useState<Record<string, number>>({});
  
  const [contactosPrevios, setContactosPrevios] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  
  const mensajesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEmpleados();
    fetchSinLeer();
    fetchContactosPrevios();
    
    const interval = setInterval(() => {
      fetchSinLeer();
      fetchContactosPrevios();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (contactoActivo) {
      fetchMensajes();
      const interval = setInterval(fetchMensajes, 5000);
      return () => clearInterval(interval);
    }
  }, [contactoActivo]);

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const fetchEmpleados = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('usuarios')
      .select('id_usuario, nombre, email')
      .eq('rol', 'empleado');
    
    if (!error && data) setEmpleados(data);
    setLoading(false);
  };

  const fetchContactosPrevios = async () => {
    if (!miId) return;
    const { data, error } = await supabase
      .from('mensajes')
      .select('emisor_id, receptor_id')
      .or(`emisor_id.eq.${miId},receptor_id.eq.${miId}`);
      
    if (!error && data) {
      const ids = new Set<string>();
      data.forEach((m: any) => {
        if (m.emisor_id !== miId) ids.add(m.emisor_id);
        if (m.receptor_id !== miId) ids.add(m.receptor_id);
      });
      setContactosPrevios(Array.from(ids));
    }
  };

  const fetchSinLeer = async () => {
    if (!miId) return;
    const { data, error } = await supabase
      .from('mensajes')
      .select('emisor_id')
      .eq('receptor_id', miId)
      .eq('leido', false);

    if (!error && data) {
      const conteo: Record<string, number> = {};
      data.forEach((m: any) => {
        conteo[m.emisor_id] = (conteo[m.emisor_id] || 0) + 1;
      });
      setSinLeer(conteo);
    }
  };

  const fetchMensajes = async () => {
    if (!contactoActivo || !miId) return;
    
    const { data, error } = await supabase
      .from('mensajes')
      .select('*')
      .or(`and(emisor_id.eq.${miId},receptor_id.eq.${contactoActivo.id_usuario}),and(emisor_id.eq.${contactoActivo.id_usuario},receptor_id.eq.${miId})`)
      .order('fecha_envio', { ascending: true });

    if (!error && data) {
      setMensajes(data);
      const noLeidos = data.filter((m: any) => !m.leido && m.receptor_id === miId);
      if (noLeidos.length > 0) {
        const ids = noLeidos.map((m: any) => m.id_mensaje);
        await supabase.from('mensajes').update({ leido: true }).in('id_mensaje', ids);
        fetchSinLeer(); 
      }
    }
  };

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() || !contactoActivo || !miId) return;

    const bMsj = {
      emisor_id: miId,
      receptor_id: contactoActivo.id_usuario,
      contenido: nuevoMensaje.trim()
    };

    const { error } = await supabase.from('mensajes').insert([bMsj]);
    
    if (!error) {
      setNuevoMensaje(''); 
      fetchMensajes();
      if (!contactosPrevios.includes(contactoActivo.id_usuario)) {
        setContactosPrevios(prev => [...prev, contactoActivo.id_usuario]);
      }
    } else {
      console.error("Error al enviar mensaje:", error);
      alert("No se pudo enviar el mensaje. Revisa la consola para más detalles.");
    }
  };

  const contactosAMostrar = empleados.filter(emp => 
    contactosPrevios.includes(emp.id_usuario) || 
    contactoActivo?.id_usuario === emp.id_usuario || 
    (sinLeer[emp.id_usuario] || 0) > 0
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors relative">
      
      {/* BARRA LATERAL */}
      <div className={`w-full md:w-80 bg-gray-50/50 dark:bg-slate-900/30 border-r border-gray-100 dark:border-slate-700 p-4 flex flex-col ${contactoActivo ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-800 dark:text-white">Conversaciones</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            aria-label="Nueva Conversación"
            className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer"
            title="Crear nueva conversación"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 italic">Cargando...</p>
        ) : contactosAMostrar.length === 0 ? (
          <div className="text-center mt-10 text-slate-400 dark:text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
            <p className="text-sm font-medium">No hay mensajes recientes.</p>
            <p className="text-xs mt-1">Haz clic en el botón + para iniciar un chat.</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto flex-1 hide-scrollbar">
            {contactosAMostrar.map(emp => {
              const unreadCount = sinLeer[emp.id_usuario] || 0;
              const isActive = contactoActivo?.id_usuario === emp.id_usuario;

              return (
                <button 
                  key={emp.id_usuario} 
                  onClick={() => setContactoActivo(emp)}
                  className={`w-full text-left p-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black uppercase flex-shrink-0 ${isActive ? 'bg-blue-500 text-white' : 'bg-indigo-500 text-white'}`}>
                    {emp.nombre.substring(0,2)}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="truncate">{emp.nombre}</p>
                    <p className={`text-[10px] font-medium truncate ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>{emp.email}</p>
                  </div>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex-shrink-0">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ÁREA DE CHAT */}
      {contactoActivo ? (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-800">
          <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <button onClick={() => setContactoActivo(null)} aria-label="Volver atrás" className="md:hidden text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </button>
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-black uppercase">
              {contactoActivo.nombre.substring(0,2)}
            </div>
            <span className="font-extrabold text-slate-800 dark:text-white">{contactoActivo.nombre}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
            {(() => {
              let ultimaFecha = '';
              return mensajes.map((m) => {
                const yo = m.emisor_id === miId;
                const d = new Date(m.fecha_envio);
                const fechaMensaje = d.toLocaleDateString([], {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                });
                
                const mostrarSeparador = fechaMensaje !== ultimaFecha;
                ultimaFecha = fechaMensaje;
                
                let textoSeparador = fechaMensaje;
                const hoyStr = new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
                const ayerStr = new Date(Date.now() - 86400000).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
                
                if (fechaMensaje === hoyStr) {
                  textoSeparador = 'Hoy';
                } else if (fechaMensaje === ayerStr) {
                  textoSeparador = 'Ayer';
                }

                return (
                  <React.Fragment key={m.id_mensaje}>
                    {mostrarSeparador && (
                      <div className="flex justify-center my-4">
                        <span className="bg-gray-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm border border-gray-200/50 dark:border-slate-600/50">
                          {textoSeparador}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${yo ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl p-3 text-sm font-medium shadow-sm ${yo ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                        <p className="leading-relaxed break-words">{m.contenido}</p>
                        <p className={`text-[9px] mt-1 text-right ${yo ? 'text-blue-200' : 'text-slate-400'}`}>
                          {d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              });
            })()}
            <div ref={mensajesEndRef} />
          </div>

          <div className="p-4 bg-gray-50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-700">
            <form onSubmit={handleEnviar} className="flex gap-3">
              <input 
                type="text" 
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                placeholder="Escribe una respuesta oficial..."
                className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
              <button 
                type="submit" 
                disabled={!nuevoMensaje.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white p-3 rounded-xl transition-colors cursor-pointer shadow-md flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-gray-50/30 dark:bg-slate-900/50 text-gray-400 dark:text-slate-500">
          <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
          <p className="text-sm font-bold">Selecciona una conversación para empezar a chatear.</p>
        </div>
      )}

      {/* MODAL NUEVA CONVERSACIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] border border-gray-100 dark:border-slate-700">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
              <h3 className="font-black text-slate-800 dark:text-white">Nueva Conversación</h3>
              <button aria-label="Cerrar modal" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-100 dark:border-slate-700">
              <input 
                type="text" 
                placeholder="Buscar empleado..." 
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 hide-scrollbar">
              {empleados
                .filter(e => e.nombre.toLowerCase().includes(busqueda.toLowerCase()))
                .map(emp => (
                <button
                  key={emp.id_usuario}
                  onClick={() => {
                    setContactoActivo(emp);
                    setIsModalOpen(false);
                    setBusqueda('');
                  }}
                  className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-black uppercase flex-shrink-0">
                    {emp.nombre.substring(0,2)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{emp.nombre}</p>
                    <p className="text-[10px] text-slate-500 truncate">{emp.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}