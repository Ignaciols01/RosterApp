import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Turno {
  id_turno: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

interface Solicitud {
  id_solicitud: string;
  fecha_solicitada: string;
  estado: string;
  motivo_rechazo: string | null;
}

interface Anuncio {
  id_anuncio: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  autor: string;
}

export default function EmployeeMisTurnos() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [misSolicitudes, setMisSolicitudes] = useState<Solicitud[]>([]);
  
  // ESTADOS DEL USUARIO PARA LA BARRA DE PROGRESO
  const [diasLibres, setDiasLibres] = useState(0);
  const [findesTrabajados, setFindesTrabajados] = useState(0);
  
  // ESTADOS DE LOS ANUNCIOS
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  const [fechaReferencia, setFechaReferencia] = useState(new Date());
  const [vistaCalendario, setVistaCalendario] = useState<'semana' | 'mes'>('semana');
  const [diaModalSeleccionado, setDiaModalSeleccionado] = useState<Date | null>(null);

  const [showModalLibre, setShowModalLibre] = useState(false);
  const [fechaLibre, setFechaLibre] = useState('');
  
  const [alerta, setAlerta] = useState<{titulo: string, texto: string, tipo: 'exito' | 'error'} | null>(null);

  const user = JSON.parse(localStorage.getItem('rosterapp_user') || '{}');
  const hoyStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (user.id) {
      fetchDatosUsuario();
      fetchTurnos();
      fetchMisSolicitudes();
      fetchAnuncios();
    }
  }, [fechaReferencia, vistaCalendario]);

  const fetchDatosUsuario = async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('dias_libres_disponibles, findes_trabajados')
      .eq('id_usuario', user.id)
      .single();
      
    if (!error && data) {
      setDiasLibres(data.dias_libres_disponibles || 0);
      setFindesTrabajados(data.findes_trabajados || 0);
    }
  };

  const fetchMisSolicitudes = async () => {
    const { data, error } = await supabase
      .from('solicitudes_libres')
      .select('*')
      .eq('id_usuario', user.id);
    if (!error && data) {
      setMisSolicitudes(data);
    }
    fetchDatosUsuario();
  };

  const fetchAnuncios = async () => {
    const { data, error } = await supabase
      .from('anuncios')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(3);
      
    if (!error && data) {
      // Filtramos los anuncios que el usuario ya ha marcado como leídos
      const leidos = JSON.parse(localStorage.getItem(`rosterapp_anuncios_leidos_${user.id}`) || '[]');
      const anunciosNoLeidos = data.filter((anuncio: Anuncio) => !leidos.includes(anuncio.id_anuncio));
      setAnuncios(anunciosNoLeidos);
    }
  };

  const marcarAnuncioComoLeido = (id_anuncio: string) => {
    const leidosActuales = JSON.parse(localStorage.getItem(`rosterapp_anuncios_leidos_${user.id}`) || '[]');
    const nuevosLeidos = [...leidosActuales, id_anuncio];
    localStorage.setItem(`rosterapp_anuncios_leidos_${user.id}`, JSON.stringify(nuevosLeidos));
    setAnuncios(anuncios.filter(a => a.id_anuncio !== id_anuncio));
  };

  const fetchTurnos = async () => {
    setLoading(true);
    let fechaInicioStr = '';
    let fechaFinStr = '';

    if (vistaCalendario === 'semana') {
      const lunes = getLunes(fechaReferencia);
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      fechaInicioStr = lunes.toISOString().split('T')[0];
      fechaFinStr = domingo.toISOString().split('T')[0];
    } else {
      const primerDiaMes = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1);
      const ultimoDiaMes = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth() + 1, 0);
      fechaInicioStr = new Date(primerDiaMes.getTime() - (primerDiaMes.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      fechaFinStr = new Date(ultimoDiaMes.getTime() - (ultimoDiaMes.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }

    try {
      const { data, error } = await supabase
        .from('asignaciones')
        .select(`turnos(id_turno, fecha, hora_inicio, hora_fin)`)
        .eq('id_usuario', user.id);

      if (error) throw error;

      if (data) {
        const turnosFormateados = data
          .map((a: any) => a.turnos)
          .filter((t: any) => t && t.fecha >= fechaInicioStr && t.fecha <= fechaFinStr);
        setTurnos(turnosFormateados);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSolicitarLibre = async () => {
    if (!fechaLibre) {
      setAlerta({ titulo: 'Aviso', texto: 'Por favor, selecciona una fecha.', tipo: 'error' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('solicitudes_libres')
        .insert([{ id_usuario: user.id, fecha_solicitada: fechaLibre, estado: 'pendiente' }]);

      if (error) throw error;

      setAlerta({ titulo: '¡Enviado!', texto: 'Tu solicitud ha sido enviada al administrador.', tipo: 'exito' });
      setShowModalLibre(false);
      setFechaLibre('');
      fetchMisSolicitudes();
    } catch (err: any) {
      console.error("Error al solicitar libre:", err);
      setAlerta({ titulo: 'Error', texto: err.message || 'No se pudo enviar la solicitud.', tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getLunes = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const lunesActual = getLunes(fechaReferencia);
  const diasSemana = Array.from({ length: 7 }).map((_, i) => {
    const dia = new Date(lunesActual);
    dia.setDate(lunesActual.getDate() + i);
    return dia;
  });

  const generarDiasMes = () => {
    const primerDia = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1);
    const ultimoDia = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth() + 1, 0);
    let diaInicioSemana = primerDia.getDay() - 1;
    if (diaInicioSemana === -1) diaInicioSemana = 6; 
    
    const dias = [];
    for (let i = 0; i < diaInicioSemana; i++) dias.push(null);
    for (let i = 1; i <= ultimoDia.getDate(); i++) dias.push(new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), i));
    return dias;
  };
  const diasMes = generarDiasMes();

  const irAnterior = () => {
    const nuevaFecha = new Date(fechaReferencia);
    vistaCalendario === 'semana' ? nuevaFecha.setDate(nuevaFecha.getDate() - 7) : nuevaFecha.setMonth(nuevaFecha.getMonth() - 1);
    setFechaReferencia(nuevaFecha);
  };

  const irSiguiente = () => {
    const nuevaFecha = new Date(fechaReferencia);
    vistaCalendario === 'semana' ? nuevaFecha.setDate(nuevaFecha.getDate() + 7) : nuevaFecha.setMonth(nuevaFecha.getMonth() + 1);
    setFechaReferencia(nuevaFecha);
  };

  const formatearFecha = (fecha: Date) => {
    const mes = fecha.toLocaleDateString('es-ES', { month: 'short' });
    const año = fecha.getFullYear();
    return `${mes.charAt(0).toUpperCase() + mes.slice(1)} De ${año}`;
  };

  const nombresDiasCortos = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const getTurnosParaElDia = (fecha: Date) => {
    const offset = fecha.getTimezoneOffset();
    const fechaFormat = new Date(fecha.getTime() - (offset*60*1000)).toISOString().split('T')[0];
    return turnos.filter(t => t.fecha === fechaFormat);
  };

  const getSolicitudParaElDia = (fecha: Date) => {
    const offset = fecha.getTimezoneOffset();
    const fechaFormat = new Date(fecha.getTime() - (offset*60*1000)).toISOString().split('T')[0];
    return misSolicitudes.find(s => s.fecha_solicitada === fechaFormat);
  };

  const tieneSolicitudPendiente = misSolicitudes.some(s => s.estado === 'pendiente');
  const sinDiasLibres = diasLibres <= 0;

  return (
    <div className="p-4 md:p-8 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors duration-300 max-w-7xl mx-auto">
      
      {/* CABECERA CON BARRA DE PROGRESO */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-8 gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-blue-700 dark:text-blue-400">Mis Turnos</h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-medium">Revisa tu horario y solicita días libres</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full xl:w-auto">
          <div className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4 flex-1 sm:flex-none">
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Días Libres</p>
              <p className="text-xl md:text-2xl font-black text-blue-600 dark:text-blue-400 leading-none mt-1">{diasLibres}</p>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-slate-700"></div>
            <div className="min-w-[120px]">
              <div className="flex justify-between mb-1.5">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Progreso</span>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{findesTrabajados % 3}/3</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${((findesTrabajados % 3) / 3) * 100}%` }}></div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 justify-center flex-1 sm:flex-none">
            <button 
              onClick={() => setShowModalLibre(true)} 
              disabled={tieneSolicitudPendiente || sinDiasLibres}
              className={`w-full text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 h-full ${
                (tieneSolicitudPendiente || sinDiasLibres) 
                  ? 'bg-gray-400 dark:bg-slate-700 cursor-not-allowed text-gray-100' 
                  : 'bg-orange-500 hover:bg-orange-600 cursor-pointer'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              {tieneSolicitudPendiente ? 'Solicitud en Curso' : sinDiasLibres ? 'Sin días libres' : 'Solicitar Día Libre'}
            </button>
            {tieneSolicitudPendiente && <span className="text-[10px] text-orange-500 font-bold text-center">Debes esperar revisión.</span>}
            {!tieneSolicitudPendiente && sinDiasLibres && <span className="text-[10px] text-gray-400 font-bold text-center">Gana días trabajando findes.</span>}
          </div>
        </div>
      </div>

      {/* TABLÓN DE ANUNCIOS CON BOTÓN "MARCAR COMO LEÍDO" */}
      {anuncios.length > 0 && (
        <div className="mb-8 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
          <h3 className="text-xs font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
            Tablón Oficial de Anuncios
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {anuncios.map(anuncio => (
              <div key={anuncio.id_anuncio} className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border-l-4 border-blue-500 relative group flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2 pr-8">
                    <span className="font-extrabold text-gray-800 dark:text-white text-sm leading-tight">{anuncio.titulo}</span>
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-300 block mb-3 whitespace-pre-wrap">{anuncio.mensaje}</span>
                </div>
                
                <div className="flex items-center justify-between border-t border-gray-200 dark:border-slate-700 pt-3 mt-auto">
                  <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-700">
                    {new Date(anuncio.fecha).toLocaleDateString()}
                  </span>
                  
                  <button 
                    onClick={() => marcarAnuncioComoLeido(anuncio.id_anuncio)}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    Marcar como leído
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTROLES DE CALENDARIO */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <h2 className="text-lg md:text-xl font-bold text-gray-700 dark:text-white capitalize truncate w-full md:w-auto">
          {vistaCalendario === 'semana' ? 'Semana Actual | ' : 'Mes Actual | '}
          <span className="text-blue-600 dark:text-blue-400">{formatearFecha(fechaReferencia)}</span>
        </h2>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setVistaCalendario('semana')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${vistaCalendario === 'semana' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>Semana</button>
            <button onClick={() => setVistaCalendario('mes')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${vistaCalendario === 'mes' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>Mes</button>
          </div>
          <div className="flex items-center space-x-1">
            <button onClick={irAnterior} className="p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">- Anterior</button>
            <button onClick={() => setFechaReferencia(new Date())} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold px-4 cursor-pointer transition-colors">Hoy</button>
            <button onClick={irSiguiente} className="p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Siguiente -</button>
          </div>
        </div>
      </div>

      {/* MATRIZ DE CALENDARIO */}
      <div className="overflow-x-auto pb-4 hide-scrollbar">
        {vistaCalendario === 'semana' ? (
          <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-slate-700 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-sm min-w-[700px]">
            {diasSemana.map((dia, i) => {
              const hoy = new Date();
              const esHoy = dia.getDate() === hoy.getDate() && dia.getMonth() === hoy.getMonth() && dia.getFullYear() === hoy.getFullYear();
              const turnosDelDia = getTurnosParaElDia(dia);
              const sol = getSolicitudParaElDia(dia);

              return (
                <div key={i} onClick={() => setDiaModalSeleccionado(dia)} className={`min-h-[300px] flex flex-col transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/80 ${esHoy ? 'bg-blue-50/10 dark:bg-slate-800 ring-2 ring-inset ring-blue-500 z-10' : 'bg-white dark:bg-slate-800'}`}>
                  <div className={`p-3 text-center border-b border-gray-100 dark:border-slate-700/50 font-bold text-sm ${esHoy ? 'text-blue-600 bg-blue-100/50 dark:bg-blue-900/30' : i >= 5 ? 'text-red-500 bg-red-50/10 dark:bg-red-900/10' : 'text-blue-600 dark:text-blue-400 bg-gray-50/50 dark:bg-slate-800/50'}`}>
                    {nombresDiasCortos[dia.getDay()]} {dia.getDate()}
                  </div>
                  <div className="flex-1 flex flex-col p-2 space-y-2 overflow-y-auto pointer-events-none">
                    
                    {sol && (
                      <div className={`p-2 rounded-lg shadow-sm border flex flex-col justify-center ${sol.estado === 'pendiente' ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800/50 dark:text-orange-400' : sol.estado === 'aprobada' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400'}`}>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest block mb-1">Día Libre</span>
                        <span className="text-xs font-bold block capitalize">{sol.estado}</span>
                        {sol.estado === 'rechazada' && sol.motivo_rechazo && (
                          <span className="text-[9px] mt-1 block italic border-t border-red-200 dark:border-red-800/50 pt-1 leading-tight">Motivo: {sol.motivo_rechazo}</span>
                        )}
                      </div>
                    )}

                    {loading ? (
                      <div className="h-full flex items-center justify-center"><span className="text-[10px] text-gray-400">...</span></div>
                    ) : !(sol && sol.estado === 'aprobada') ? (
                      turnosDelDia.length > 0 ? (
                        turnosDelDia.map(turno => (
                          <div key={turno.id_turno} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-3 rounded-lg shadow-sm">
                            <span className="text-sm font-extrabold text-blue-700 dark:text-blue-400 block">{turno.hora_inicio.substring(0,5)} - {turno.hora_fin.substring(0,5)}</span>
                          </div>
                        ))
                      ) : (
                        !sol && <div className="h-full flex items-center justify-center"><span className="font-bold uppercase tracking-widest text-[10px] italic text-gray-300 dark:text-slate-600">Libre</span></div>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-sm min-w-[700px]">
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
                <div key={i} className={`p-3 text-center text-xs font-bold uppercase ${i >= 5 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-slate-700">
              {diasMes.map((dia, i) => {
                if (!dia) return <div key={i} className="bg-gray-50 dark:bg-slate-800/30 min-h-[120px]"></div>;
                const hoy = new Date();
                const esHoy = dia.getDate() === hoy.getDate() && dia.getMonth() === hoy.getMonth() && dia.getFullYear() === hoy.getFullYear();
                const turnosDelDia = getTurnosParaElDia(dia);
                const sol = getSolicitudParaElDia(dia);

                return (
                  <div key={i} onClick={() => setDiaModalSeleccionado(dia)} className={`min-h-[120px] bg-white dark:bg-slate-800 p-1 flex flex-col cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${esHoy ? 'ring-2 ring-inset ring-blue-500 relative z-10' : ''}`}>
                    <span className={`text-xs font-bold p-1 w-6 h-6 flex items-center justify-center rounded-full mb-1 ${esHoy ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>{dia.getDate()}</span>
                    <div className="flex-1 overflow-y-auto space-y-1 pointer-events-none p-0.5">
                      
                      {sol && (
                        <div className={`px-1.5 py-1 rounded text-[9px] border truncate flex flex-col items-center ${sol.estado === 'pendiente' ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' : sol.estado === 'aprobada' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                          <span className="font-extrabold capitalize">{sol.estado}</span>
                        </div>
                      )}

                      {!(sol && sol.estado === 'aprobada') && turnosDelDia.map(turno => (
                        <div key={turno.id_turno} className="bg-blue-50 dark:bg-slate-700 px-1.5 py-1 rounded text-xs border border-blue-200 dark:border-slate-600 truncate flex flex-col items-center mt-1">
                          <span className="font-extrabold text-blue-700 dark:text-blue-400">{turno.hora_inicio.substring(0,5)} - {turno.hora_fin.substring(0,5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DEL DÍA CON CORRECCIÓN DE CORTES (max-h-calc y overflow-y-auto) */}
      {diaModalSeleccionado && (() => {
        const turnosModal = getTurnosParaElDia(diaModalSeleccionado);
        const solModal = getSolicitudParaElDia(diaModalSeleccionado);

        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fade-in" onClick={() => setDiaModalSeleccionado(null)}>
            <div 
              className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden" 
              style={{ maxHeight: 'calc(100dvh - 2rem)' }} 
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-blue-600 p-5 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="font-extrabold text-lg">Tu horario</h2>
                  <p className="text-blue-100 text-sm">{diaModalSeleccionado.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <button onClick={() => setDiaModalSeleccionado(null)} className="text-white/80 hover:text-white cursor-pointer bg-blue-700/50 hover:bg-blue-700 p-2 rounded-full transition-colors shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              
              <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                {solModal && (
                  <div className={`rounded-xl p-5 text-center shadow-sm border mb-4 ${solModal.estado === 'aprobada' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50' : solModal.estado === 'pendiente' ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800/50' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/50'}`}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1 opacity-70">Día Libre</p>
                    <p className="text-2xl font-black capitalize">{solModal.estado}</p>
                    {solModal.estado === 'rechazada' && solModal.motivo_rechazo && (
                      <p className="text-sm mt-2 font-medium">Motivo: {solModal.motivo_rechazo}</p>
                    )}
                  </div>
                )}

                {!(solModal && solModal.estado === 'aprobada') && (
                  turnosModal.length > 0 ? (
                    turnosModal.map(turno => (
                      <div key={turno.id_turno} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-5 text-center shadow-sm">
                         <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Turno Asignado</p>
                         <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{turno.hora_inicio.substring(0,5)} - {turno.hora_fin.substring(0,5)}</p>
                      </div>
                    ))
                  ) : (
                    !solModal && (
                      <div className="text-center py-6">
                        <p className="text-gray-500 dark:text-gray-400 font-bold">Tienes el día libre. ¡Aprovéchalo!</p>
                      </div>
                    )
                  )
                )}
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 shrink-0">
                <button onClick={() => setDiaModalSeleccionado(null)} className="w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm text-sm">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL SOLICITAR DÍA LIBRE CON CORRECCIÓN DE CORTES */}
      {showModalLibre && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowModalLibre(false)}>
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden" 
            style={{ maxHeight: 'calc(100dvh - 2rem)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-800 dark:text-white">Día Libre</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Envía una solicitud al admin</p>
                </div>
              </div>
              <button onClick={() => setShowModalLibre(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Selecciona la fecha</label>
              <input 
                type="date" 
                value={fechaLibre} 
                min={hoyStr} 
                onChange={(e) => setFechaLibre(e.target.value)} 
                className="w-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-3 rounded-xl text-sm font-medium text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all shadow-sm dark:[color-scheme:dark]" 
              />
              <p className="text-[10px] text-gray-400 mt-2">Solo puedes solicitar días a partir de hoy.</p>
            </div>
            
            <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 flex gap-3 shrink-0">
              <button onClick={() => setShowModalLibre(false)} className="flex-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm text-sm">
                Cancelar
              </button>
              <button onClick={handleSolicitarLibre} disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-md text-sm disabled:opacity-50">
                {loading ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALERTAS CON CORRECCIÓN DE CORTES */}
      {alerta && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[400] p-4 animate-fade-in" onClick={() => setAlerta(null)}>
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden border border-gray-100 dark:border-slate-700" 
            style={{ maxHeight: 'calc(100dvh - 2rem)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 text-center flex-1 overflow-y-auto">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${alerta.tipo === 'exito' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500'}`}>
                {alerta.tipo === 'exito' ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                ) : (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                )}
              </div>
              <h2 className="text-xl font-extrabold text-gray-800 dark:text-white mb-2">{alerta.titulo}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{alerta.texto}</p>
              <button onClick={() => setAlerta(null)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-md text-sm">
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}