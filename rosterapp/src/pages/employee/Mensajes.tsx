import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface Usuario {
  id_usuario: string;
  nombre: string;
}

interface Mensaje {
  id_mensaje: string;
  emisor_id: string;
  receptor_id: string;
  contenido: string;
  fecha_envio: string;
  leido: boolean;
}

export default function EmployeeMensajes() {
  const user = JSON.parse(localStorage.getItem('rosterapp_user') || '{}');
  const miId = user.id_usuario || user.id; 
  
  const [administradores, setAdministradores] = useState<Usuario[]>([]);
  const [contactoActivo, setContactoActivo] = useState<Usuario | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [loading, setLoading] = useState(true);
  
  // NUEVO: Estado para llevar la cuenta de mensajes sin leer de cada admin
  const [sinLeer, setSinLeer] = useState<Record<string, number>>({});

  const mensajesEndRef = useRef<HTMLDivElement>(null);

  // Efecto global: Carga admins y vigila los mensajes sin leer cada 5 segundos
  useEffect(() => {
    fetchAdministradores();
    fetchSinLeer();
    const interval = setInterval(fetchSinLeer, 5000);
    return () => clearInterval(interval);
  }, []);

  // Efecto local: Recarga el chat activo
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

  const fetchAdministradores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('usuarios')
      .select('id_usuario, nombre')
      .eq('rol', 'administrador');
    
    if (!error && data) setAdministradores(data);
    setLoading(false);
  };

  // NUEVA FUNCIÓN: Descarga mis mensajes pendientes y los agrupa por remitente
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
      
      // Marcar como leídos los que son para mí y refrescar
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
    } else {
      console.error("Error al enviar mensaje:", error);
      alert("No se pudo enviar el mensaje. Revisa la consola para más detalles.");
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 transition-colors">
      
      <div className={`w-full md:w-80 bg-gray-50/50 dark:bg-slate-900/30 border-r border-gray-100 dark:border-slate-700 p-4 flex flex-col ${contactoActivo ? 'hidden md:flex' : 'flex'}`}>
        <h2 className="text-lg font-black text-slate-800 dark:text-white mb-4">Administradores</h2>
        {loading ? (
          <p className="text-sm text-slate-400 italic">Cargando jefatura...</p>
        ) : (
          <div className="space-y-2 overflow-y-auto flex-1">
            {administradores.map(admin => {
              const unreadCount = sinLeer[admin.id_usuario] || 0;
              const isActive = contactoActivo?.id_usuario === admin.id_usuario;

              return (
                <button 
                  key={admin.id_usuario} 
                  onClick={() => setContactoActivo(admin)}
                  className={`w-full text-left p-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black uppercase flex-shrink-0 ${isActive ? 'bg-blue-500 text-white' : 'bg-blue-500 text-white'}`}>
                    {admin.nombre.substring(0,2)}
                  </div>
                  <span className="flex-1 truncate">{admin.nombre}</span>

                  {/* AQUÍ SE PINTA EL AVISO DEL ADMINISTRADOR ESPECÍFICO */}
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

      {contactoActivo ? (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-800">
          
          <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <button onClick={() => setContactoActivo(null)} className="md:hidden text-slate-400 hover:text-slate-600">
              ← Volver
            </button>
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-black uppercase">
              {contactoActivo.nombre.substring(0,2)}
            </div>
            <span className="font-extrabold text-slate-800 dark:text-white">{contactoActivo.nombre}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
            {mensajes.map(m => {
              const yo = m.emisor_id === miId;
              return (
                <div key={m.id_mensaje} className={`flex ${yo ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-2xl p-3 text-sm font-medium shadow-sm ${yo ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                    <p className="leading-relaxed break-words">{m.contenido}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <p className={`text-[9px] text-right ${yo ? 'text-blue-200' : 'text-slate-400'}`}>
                        {new Date(m.fecha_envio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={mensajesEndRef} />
          </div>

          <div className="p-4 bg-gray-50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-700">
            <form onSubmit={handleEnviar} className="flex gap-3">
              <input 
                type="text" 
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                placeholder="Escribe un mensaje corporativo..."
                className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
              <button 
                type="submit" 
                disabled={!nuevoMensaje.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white p-3 rounded-xl transition-colors cursor-pointer shadow-md flex-shrink-0"
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-gray-50/30 dark:bg-slate-900/50 text-gray-400 dark:text-slate-500">
          <p className="text-sm font-bold">Selecciona un administrador para abrir un hilo de conversación.</p>
        </div>
      )}
    </div>
  );
}