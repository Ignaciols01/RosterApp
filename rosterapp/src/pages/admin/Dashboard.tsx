import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Turno {
  id_turno: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  usuarios: { nombre: string }[];
}

interface Solicitud {
  id_solicitud: string;
  fecha_solicitada: string;
  estado: string;
  motivo_rechazo?: string | null;
  usuarios: { id_usuario: string, nombre: string };
}

interface AlertaPlanificacion {
  id_usuario: string;
  nombre: string;
  ultimaFecha: string | null;
  diasRestantes: number;
  nivel: 'critico' | 'aviso';
}

export default function AdminDashboard() {
  const [totalEmpleados, setTotalEmpleados] = useState(0);
  const [turnosSemana, setTurnosSemana] = useState(0);
  const [loading, setLoading] = useState(true);
  const [alertasPlanificacion, setAlertasPlanificacion] = useState<AlertaPlanificacion[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [empleados, setEmpleados] = useState<{id_usuario: string, nombre: string}[]>([]);
  const [selectedEmpleado, setSelectedEmpleado] = useState('');
  const [tipoRepeticion, setTipoRepeticion] = useState('unico');
  const [diasSeleccionados, setDiasSeleccionados] = useState<string[]>([]);
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFin, setHoraFin] = useState('15:00');

  const [showModalBorrar, setShowModalBorrar] = useState(false);
  const [borrarEmpleado, setBorrarEmpleado] = useState('');
  const [borrarFechaInicio, setBorrarFechaInicio] = useState('');
  const [borrarFechaFin, setBorrarFechaFin] = useState('');
  
  const [fechaReferencia, setFechaReferencia] = useState(new Date());
  const [vistaCalendario, setVistaCalendario] = useState<'semana' | 'mes'>('semana');
  const [turnosCalendario, setTurnosCalendario] = useState<Turno[]>([]);
  const [solicitudesCalendario, setSolicitudesCalendario] = useState<Solicitud[]>([]);
  const [diaModalSeleccionado, setDiaModalSeleccionado] = useState<Date | null>(null);
  
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [showModalSolicitudes, setShowModalSolicitudes] = useState(false);
  const [showModalAlertas, setShowModalAlertas] = useState(false);
  const [solicitudARechazar, setSolicitudARechazar] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  
  // Estados para el Tablón de Anuncios
  const [showModalAnuncio, setShowModalAnuncio] = useState(false);
  const [tituloAnuncio, setTituloAnuncio] = useState('');
  const [mensajeAnuncio, setMensajeAnuncio] = useState('');

  const [elementoAEliminar, setElementoAEliminar] = useState<{ tipo: 'unico', idTurno: string } | { tipo: 'dia', fecha: Date } | null>(null);
  const [alerta, setAlerta] = useState<{titulo: string, texto: string, tipo: 'exito' | 'error'} | null>(null);

  const horasArray = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutosArray = ['00', '15', '30', '45'];

  useEffect(() => { cargarTodo(); }, []);
  useEffect(() => { fetchTurnosCalendario(); }, [fechaReferencia, vistaCalendario]);

  const cargarTodo = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStats(), fetchEmpleados(), fetchSolicitudes()]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empleados.length > 0) comprobarHuecosPlanificacion();
  }, [empleados, turnosCalendario]);

  const comprobarHuecosPlanificacion = async () => {
    const nuevasAlertas: AlertaPlanificacion[] = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (const emp of empleados) {
      const { data } = await supabase
        .from('asignaciones')
        .select('turnos(fecha)')
        .eq('id_usuario', emp.id_usuario);

      let ultimoTurno: Date | null = null;

      if (data && data.length > 0) {
        const fechas = data
          .map((a: any) => a.turnos?.fecha ? new Date(a.turnos.fecha) : null)
          .filter((d: Date | null) => d !== null) as Date[];

        if (fechas.length > 0) {
          fechas.sort((a, b) => b.getTime() - a.getTime());
          ultimoTurno = fechas[0];
        }
      }
      
      let diasRestantes = -1;
      if (ultimoTurno) {
        diasRestantes = Math.ceil((ultimoTurno.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      }

      if (diasRestantes < 21) {
        nuevasAlertas.push({
          id_usuario: emp.id_usuario,
          nombre: emp.nombre,
          ultimaFecha: ultimoTurno ? ultimoTurno.toLocaleDateString('es-ES') : 'Nunca',
          diasRestantes: diasRestantes,
          nivel: diasRestantes < 7 ? 'critico' : 'aviso'
        });
      }
    }
    setAlertasPlanificacion(nuevasAlertas.sort((a, b) => a.diasRestantes - b.diasRestantes));
  };

  const fetchStats = async () => {
    const { count } = await supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('rol', 'empleado');
    setTotalEmpleados(count || 0);
    const hoy = new Date();
    const lunes = new Date(hoy.setDate(hoy.getDate() - hoy.getDay() + 1)).toISOString().split('T')[0];
    const domingo = new Date(hoy.setDate(hoy.getDate() - hoy.getDay() + 7)).toISOString().split('T')[0];
    const { count: cT } = await supabase.from('turnos').select('*', { count: 'exact', head: true }).gte('fecha', lunes).lte('fecha', domingo);
    setTurnosSemana(cT || 0);
  };

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('usuarios').select('id_usuario, nombre').eq('rol', 'empleado');
    if (data) setEmpleados(data);
  };

  const fetchSolicitudes = async () => {
    const { data } = await supabase.from('solicitudes_libres').select('id_solicitud, fecha_solicitada, estado, usuarios(id_usuario, nombre)').eq('estado', 'pendiente');
    if (data) setSolicitudes(data as any);
  };

  const gestionarSolicitud = async (id: string, user: string, fecha: string, acc: 'aprobada' | 'rechazada') => {
    setLoading(true);
    try {
      const up: any = { estado: acc };
      if (acc === 'rechazada') up.motivo_rechazo = motivoRechazo;
      await supabase.from('solicitudes_libres').update(up).eq('id_solicitud', id);
      
      if (acc === 'aprobada') {
        const { data: userData } = await supabase.from('usuarios').select('dias_libres_disponibles').eq('id_usuario', user).single();
        if (userData && userData.dias_libres_disponibles > 0) {
          await supabase.from('usuarios').update({ dias_libres_disponibles: userData.dias_libres_disponibles - 1 }).eq('id_usuario', user);
        }
      }

      const fechaFormateada = new Date(fecha).toLocaleDateString('es-ES');
      const tituloNotif = acc === 'aprobada' ? 'Día libre aprobado' : 'Día libre rechazado';
      const mensajeNotif = acc === 'aprobada' 
        ? `Tu solicitud para el día ${fechaFormateada} ha sido aprobada.`
        : `Tu solicitud para el día ${fechaFormateada} no ha podido ser aprobada. Motivo: ${motivoRechazo}`;

      await supabase.from('notificaciones').insert([{
        id_usuario: user,
        titulo: tituloNotif,
        mensaje: mensajeNotif,
        leida: false
      }]);

      setSolicitudARechazar(null); setMotivoRechazo('');
      await cargarTodo(); await fetchTurnosCalendario();
    } catch (e) {
      setAlerta({ titulo: 'Error', texto: 'No se pudo procesar la solicitud.', tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // CONTROL DE INSERCIÓN DEL TABLÓN CORREGIDO (AUTOR INMUTABLE "ADMINISTRACIÓN")
  const handlePublicarAnuncio = async () => {
    if (!tituloAnuncio || !mensajeAnuncio) {
      setAlerta({ titulo: 'Aviso', texto: 'Rellena el título y el mensaje del anuncio.', tipo: 'error' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('anuncios').insert([{
        titulo: tituloAnuncio,
        mensaje: mensajeAnuncio,
        autor: 'Administración'
      }]);
      if (error) throw new Error(error.message);
      
      setAlerta({ titulo: '¡Publicado!', texto: 'El aviso se ha distribuido con éxito en la cartelera digital de los empleados.', tipo: 'exito' });
      setShowModalAnuncio(false);
      setTituloAnuncio('');
      setMensajeAnuncio('');
    } catch (err: any) {
      setAlerta({ titulo: 'Error', texto: err.message, tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTurnosCalendario = async () => {
    let fI = ''; let fF = '';
    if (vistaCalendario === 'semana') {
      const lunes = getLunes(fechaReferencia); const dom = new Date(lunes); dom.setDate(lunes.getDate() + 6);
      fI = lunes.toISOString().split('T')[0]; fF = dom.toISOString().split('T')[0];
    } else {
      const pM = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1);
      const uM = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth() + 1, 0);
      fI = new Date(pM.getTime() - (pM.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      fF = new Date(uM.getTime() - (uM.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const { data } = await supabase.from('turnos').select(`id_turno, fecha, hora_inicio, hora_fin, asignaciones (usuarios (nombre))`).gte('fecha', fI).lte('fecha', fF);
    if (data) {
      const formated = data.map((t: any) => ({ ...t, usuarios: t.asignaciones ? t.asignaciones.map((a: any) => a.usuarios).filter(Boolean) : [] })).filter((t: any) => t.usuarios.length > 0); 
      setTurnosCalendario(formated);
    }
    const { data: dS = [] } = await supabase.from('solicitudes_libres').select('id_solicitud, fecha_solicitada, estado, usuarios(id_usuario, nombre)').gte('fecha_solicitada', fI).lte('fecha_solicitada', fF).in('estado', ['pendiente', 'aprobada']);
    if (dS) setSolicitudesCalendario(dS as any);
  };

  const toggleDia = (dia: string) => { setDiasSeleccionados(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]); };

  const handleGuardarTurno = async () => {
    if (!selectedEmpleado || diasSeleccionados.length === 0) {
      setAlerta({ titulo: 'Aviso', texto: 'Selecciona un empleado y al menos un día.', tipo: 'error' });
      return;
    }
    setLoading(true);
    try {
      const lunesRef = getLunes(fechaReferencia);
      const mapaDias: { [key: string]: number } = { 'Lun': 0, 'Mar': 1, 'Mié': 2, 'Jue': 3, 'Vie': 4, 'Sáb': 5, 'Dom': 6 };
      
      let reps = 1;
      if (tipoRepeticion === 'semanal' || tipoRepeticion === 'rotativo') reps = 12;
      if (tipoRepeticion === 'medio_ano') reps = 26; 

      for (let i = 0; i < reps; i++) {
        if (tipoRepeticion === 'rotativo' && i % 2 !== 0) continue;
        for (const diaNombre of diasSeleccionados) {
          const f = new Date(lunesRef);
          f.setDate(lunesRef.getDate() + mapaDias[diaNombre] + (i * 7));
          const fS = f.toISOString().split('T')[0];

          const idUnico = typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
              });

          const { error: eT } = await supabase
            .from('turnos')
            .insert([{ id_turno: idUnico, fecha: fS, hora_inicio: horaInicio, hora_fin: horaFin }]);

          if (eT) throw new Error(eT.message);
          
          const { error: eA } = await supabase.from('asignaciones').insert([{ id_usuario: selectedEmpleado, id_turno: idUnico }]);
          if (eA) throw new Error(eA.message);
        }
      }
      setAlerta({ titulo: '¡Éxito!', texto: 'Turnos guardados correctamente.', tipo: 'exito' });
      setShowModal(false); setDiasSeleccionados([]); await cargarTodo(); await fetchTurnosCalendario();
    } catch (err: any) {
      setAlerta({ titulo: 'Error al guardar', texto: err.message, tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleBorrarMasivo = async () => {
    if (!borrarEmpleado || !borrarFechaInicio || !borrarFechaFin) {
      setAlerta({ titulo: 'Aviso', texto: 'Por favor, rellena todos los campos para continuar.', tipo: 'error' });
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.from('turnos').select('id_turno').gte('fecha', borrarFechaInicio).lte('fecha', borrarFechaFin);
      const ids = data?.map(t => t.id_turno) || [];
      if (ids.length > 0) {
        const { data: asig } = await supabase.from('asignaciones').select('id_turno').eq('id_usuario', borrarEmpleado).in('id_turno', ids);
        const idsB = asig?.map(a => a.id_turno) || [];
        if (idsB.length > 0) {
          await supabase.from('asignaciones').delete().in('id_turno', idsB);
          await supabase.from('turnos').delete().in('id_turno', idsB);
          setAlerta({ titulo: '¡Éxito!', texto: 'Turnos eliminados.', tipo: 'exito' });
          setShowModalBorrar(false); await cargarTodo(); await fetchTurnosCalendario();
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const confirmarEliminacion = async () => {
    if (!elementoAEliminar) return;
    setLoading(true);
    try {
      if (elementoAEliminar.tipo === 'unico') {
        await supabase.from('asignaciones').delete().eq('id_turno', elementoAEliminar.idTurno);
        await supabase.from('turnos').delete().eq('id_turno', elementoAEliminar.idTurno);
      } else {
        const tD = getTurnosParaElDia(elementoAEliminar.fecha);
        const ids = tD.map(t => t.id_turno);
        if (ids.length > 0) {
          await supabase.from('asignaciones').delete().in('id_turno', ids);
          await supabase.from('turnos').delete().in('id_turno', ids);
        }
        setDiaModalSeleccionado(null);
      }
      await cargarTodo(); await fetchTurnosCalendario();
    } catch (e) { console.error(e); } finally { setElementoAEliminar(null); setLoading(false); }
  };

  const getLunes = (d: Date) => { const date = new Date(d); const day = date.getDay(); const diff = date.getDate() - day + (day === 0 ? -6 : 1); return new Date(date.setDate(diff)); };
  const lunesActual = getLunes(fechaReferencia);
  const diasSemana = Array.from({ length: 7 }).map((_, i) => { const dia = new Date(lunesActual); dia.setDate(lunesActual.getDate() + i); return dia; });
  const generarDiasMes = () => {
    const pM = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1);
    const uM = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth() + 1, 0);
    let dI = pM.getDay() - 1; if (dI === -1) dI = 6; 
    const dias = []; for (let i = 0; i < dI; i++) dias.push(null);
    for (let i = 1; i <= uM.getDate(); i++) dias.push(new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), i));
    return dias;
  };
  const diasMes = generarDiasMes();

  const irAnterior = () => { const nF = new Date(fechaReferencia); vistaCalendario === 'semana' ? nF.setDate(nF.getDate() - 7) : nF.setMonth(nF.getMonth() - 1); setFechaReferencia(nF); };
  const irSiguiente = () => { const nF = new Date(fechaReferencia); vistaCalendario === 'semana' ? nF.setDate(nF.getDate() + 7) : nF.setMonth(nF.getMonth() + 1); setFechaReferencia(nF); };
  const formatearFecha = (fecha: Date) => { const mes = fecha.toLocaleDateString('es-ES', { month: 'short' }); const año = fecha.getFullYear(); return `${mes.charAt(0).toUpperCase() + mes.slice(1)} De ${año}`; };
  const nombresDiasCortos = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const getTurnosParaElDia = (f: Date) => { const o = f.getTimezoneOffset(); const fF = new Date(f.getTime() - (o*60*1000)).toISOString().split('T')[0]; return turnosCalendario.filter(t => t.fecha === fF); };
  const getSolicitudesParaElDia = (f: Date) => { const o = f.getTimezoneOffset(); const fF = new Date(f.getTime() - (o*60*1000)).toISOString().split('T')[0]; return solicitudesCalendario.filter(s => s.fecha_solicitada === fF); };

  return (
    <div className="p-4 md:p-8 bg-gray-50 dark:bg-[#0f172a] min-h-screen transition-colors duration-300">
      
      {/* CABECERA */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-blue-700 dark:text-blue-500 transition-colors duration-300">Panel de Control</h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-slate-400 font-medium transition-colors duration-300">Gestión inteligente de tus turnos y equipo</p>
        </div>
        <div className="flex flex-wrap items-stretch sm:items-center gap-3 w-full xl:w-auto">
          
          <button onClick={() => setShowModalAnuncio(true)} className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 border border-purple-200 dark:border-purple-900/50 font-bold py-3 px-4 rounded-lg shadow-sm transition-all cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
            Tablón
          </button>

          <button onClick={() => setShowModalSolicitudes(true)} className={`flex-1 sm:flex-none justify-center font-bold py-3 px-5 rounded-lg shadow-sm transition-all duration-300 cursor-pointer flex items-center gap-2 border ${solicitudes.length > 0 ? 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-500 animate-pulse' : 'bg-white dark:bg-[#1e293b] border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            Solicitudes ({solicitudes.length})
          </button>
          
          <button onClick={() => setShowModalBorrar(true)} className="flex-1 sm:flex-none justify-center bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 font-bold py-3 px-4 rounded-lg shadow-sm transition-all cursor-pointer">
            - BORRAR
          </button>
          
          <button onClick={() => { setSelectedEmpleado(''); setDiasSeleccionados([]); setShowModal(true); }} className="flex-1 sm:flex-none justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors cursor-pointer">
            + CREAR TURNO
          </button>
        </div>
      </div>

      {/* BANNER DE ALERTAS DE PLANIFICACIÓN */}
      {alertasPlanificacion.length > 0 && (
        <div className="mb-8 animate-fade-in bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="bg-orange-100 dark:bg-orange-900/50 p-3 rounded-xl text-orange-600 dark:text-orange-400 flex-shrink-0">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-orange-800 dark:text-orange-300">Atención: Cuadrantes vacíos</h2>
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mt-0.5">
                Hay {alertasPlanificacion.length} {alertasPlanificacion.length === 1 ? 'empleado' : 'empleados'} que se quedarán sin turnos próximamente.
              </p>
            </div>
          </div>
          <button onClick={() => setShowModalAlertas(true)} className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-colors cursor-pointer text-sm shadow-md whitespace-nowrap">
            Ver Detalles
          </button>
        </div>
      )}

      {/* ESTADÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-10">
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-center space-x-4"><div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl text-blue-600 dark:text-blue-400"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg></div><div><p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Plantilla Total</p><p className="text-xl font-bold text-gray-700 dark:text-white">{totalEmpleados} empleados</p></div></div>
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-center space-x-4"><div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-xl text-emerald-600 dark:text-emerald-400"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div><div><p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Turnos Asignados</p><p className="text-xl font-bold text-gray-700 dark:text-white">{turnosSemana} esta semana</p></div></div>
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-center space-x-4"><div className="bg-orange-50 dark:bg-orange-500/10 p-4 rounded-xl text-orange-600 dark:text-orange-400"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div><div><p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Incidencias</p><p className="text-xl font-bold text-gray-700 dark:text-white">0 pendientes</p></div></div>
      </div>

      {/* CALENDARIO Y CONTROLES */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <h2 className="text-lg md:text-xl font-bold text-gray-700 dark:text-white capitalize truncate w-full md:w-auto transition-colors duration-300">
          {vistaCalendario === 'semana' ? 'Semana Actual | ' : 'Mes Actual | '}
          <span className="text-blue-600 dark:text-blue-400">{formatearFecha(fechaReferencia)}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex bg-gray-100 dark:bg-[#1e293b] p-1 rounded-lg transition-colors duration-300">
            <button onClick={() => setVistaCalendario('semana')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors duration-300 cursor-pointer ${vistaCalendario === 'semana' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white'}`}>Semana</button>
            <button onClick={() => setVistaCalendario('mes')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors duration-300 cursor-pointer ${vistaCalendario === 'mes' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white'}`}>Mes</button>
          </div>
          <div className="flex items-center space-x-1">
            <button onClick={irAnterior} className="p-2 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-bold text-gray-600 dark:text-slate-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors duration-300">- Anterior</button>
            <button onClick={() => setFechaReferencia(new Date())} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold px-4 cursor-pointer transition-colors duration-300">Hoy</button>
            <button onClick={irSiguiente} className="p-2 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-bold text-gray-600 dark:text-slate-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors duration-300">Siguiente -</button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-4 hide-scrollbar">
        {vistaCalendario === 'semana' ? (
          <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm min-w-[800px] transition-colors duration-300">
            {diasSemana.map((dia, i) => {
              const hoy = new Date();
              const esHoy = dia.getDate() === hoy.getDate() && dia.getMonth() === hoy.getMonth() && dia.getFullYear() === hoy.getFullYear();
              const turnosDelDia = getTurnosParaElDia(dia);
              const solsDelDia = getSolicitudesParaElDia(dia);

              return (
                <div key={i} onClick={() => setDiaModalSeleccionado(dia)} className={`min-h-[300px] flex flex-col transition-colors duration-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1e293b]/80 ${esHoy ? 'bg-blue-50/10 dark:bg-[#1e293b] ring-2 ring-inset ring-blue-500 z-10' : 'bg-white dark:bg-[#1e293b]'}`}>
                  <div className={`p-3 text-center border-b border-gray-100 dark:border-slate-800 font-bold text-sm transition-colors duration-300 ${esHoy ? 'text-blue-600 bg-blue-100/50 dark:bg-blue-900/30' : i >= 5 ? 'text-red-500 bg-red-50/10 dark:bg-red-900/10' : 'text-blue-600 dark:text-blue-400 bg-gray-50/50 dark:bg-slate-900/50'}`}>
                    {nombresDiasCortos[dia.getDay()]} {dia.getDate()}
                  </div>
                  <div className="flex-1 flex flex-col p-2 space-y-2 overflow-y-auto pointer-events-none">
                    
                    {solsDelDia.map(sol => (
                      <div key={sol.id_solicitud} className={`p-2 rounded-lg shadow-sm border transition-colors duration-300 ${sol.estado === 'pendiente' ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400'}`}>
                        <span className="text-[9px] font-extrabold uppercase tracking-widest block">{sol.estado === 'pendiente' ? 'SOLICITADO' : 'LIBRE'}</span>
                        <span className="text-xs font-bold block">{sol.usuarios.nombre}</span>
                      </div>
                    ))}

                    {turnosDelDia.length > 0 ? (
                      turnosDelDia.map(turno => (
                        <div key={turno.id_turno} className="bg-transparent border border-blue-500/30 dark:border-slate-700 p-2 rounded-lg shadow-sm transition-colors duration-300">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block mb-1">{turno.hora_inicio.substring(0,5)} - {turno.hora_fin.substring(0,5)}</span>
                          {turno.usuarios.map((u, idx) => <p key={idx} className="text-xs font-bold text-gray-800 dark:text-white">{u.nombre}</p>)}
                        </div>
                      ))
                    ) : (
                      solsDelDia.length === 0 && <div className="h-full flex items-center justify-center"><span className="font-bold uppercase tracking-widest text-[10px] italic text-gray-300 dark:text-slate-600 transition-colors duration-300">Libre</span></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1e293b] rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm min-w-[800px] transition-colors duration-300">
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 transition-colors duration-300">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
                <div key={i} className={`p-3 text-center text-xs font-bold uppercase transition-colors duration-300 ${i >= 5 ? 'text-red-500' : 'text-gray-500 dark:text-slate-400'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-slate-800/50 transition-colors duration-300">
              {diasMes.map((dia, i) => {
                if (!dia) return <div key={i} className="bg-gray-50 dark:bg-slate-900/30 min-h-[120px] transition-colors duration-300"></div>;
                const hoy = new Date();
                const esHoy = dia.getDate() === hoy.getDate() && dia.getMonth() === hoy.getMonth() && dia.getFullYear() === hoy.getFullYear();
                const turnosDelDia = getTurnosParaElDia(dia);
                const solsDelDia = getSolicitudesParaElDia(dia);

                return (
                  <div key={i} onClick={() => setDiaModalSeleccionado(dia)} className={`min-h-[120px] bg-white dark:bg-[#1e293b] p-1 flex flex-col cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors duration-300 ${esHoy ? 'ring-2 ring-inset ring-blue-500 relative z-10' : ''}`}>
                    <span className={`text-xs font-bold p-1 w-6 h-6 flex items-center justify-center rounded-full mb-1 transition-colors duration-300 ${esHoy ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-slate-300'}`}>{dia.getDate()}</span>
                    <div className="flex-1 overflow-y-auto space-y-1 pointer-events-none p-0.5">
                      
                      {solsDelDia.map(sol => (
                        <div key={sol.id_solicitud} className={`px-1 py-0.5 rounded text-[9px] border truncate flex flex-col transition-colors duration-300 ${sol.estado === 'pendiente' ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400'}`}>
                          <span className="font-extrabold">{sol.usuarios.nombre.split(' ')[0]} (Libre)</span>
                        </div>
                      ))}

                      {turnosDelDia.map(turno => (
                        <div key={turno.id_turno} className="bg-blue-50/50 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] border border-blue-200 dark:border-slate-700 truncate flex flex-col transition-colors duration-300">
                          <span className="font-bold text-blue-700 dark:text-blue-400">{turno.hora_inicio.substring(0,5)} - {turno.hora_fin.substring(0,5)}</span>
                          {turno.usuarios.map((u, idx) => <span key={idx} className="text-gray-700 dark:text-slate-300 truncate">{u.nombre.split(' ')[0]}</span>)}
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

      {/* MODAL CREAR TURNO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 transition-colors duration-300">
            <div className="bg-blue-600 p-5 text-white flex justify-between items-center shadow-sm">
              <h2 className="font-extrabold text-lg">Programar Turno Avanzado</h2>
              <button onClick={() => setShowModal(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">Seleccionar Empleado</label>
                <select value={selectedEmpleado} onChange={(e) => setSelectedEmpleado(e.target.value)} className="w-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-[#0f172a] p-3 rounded-xl text-sm font-medium text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm cursor-pointer">
                  <option value="">Elegir de la plantilla...</option>
                  {empleados.map(emp => <option key={emp.id_usuario} value={emp.id_usuario}>{emp.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">Asignar a días específicos</label>
                <div className="flex flex-wrap gap-2">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => (
                    <button key={dia} onClick={() => toggleDia(dia)} className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm border ${diasSeleccionados.includes(dia) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>{dia}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">Tipo de Turno</label>
                <select value={tipoRepeticion} onChange={(e) => setTipoRepeticion(e.target.value)} className="w-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-[#0f172a] p-3 rounded-xl text-sm font-medium text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm cursor-pointer">
                  <option value="unico">Solo esta semana</option>
                  <option value="semanal">Repetir cada semana (12 semanas)</option>
                  <option value="rotativo">Findes Rotativos (Semanas alternas)</option>
                  <option value="medio_ano">Repetir medio año (26 semanas)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">Horario</label>
                <div className="flex gap-2 mb-3">
                  <button type="button" onClick={() => {setHoraInicio('08:00'); setHoraFin('15:00');}} className="flex-1 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold py-2 rounded-xl transition-colors cursor-pointer border border-transparent uppercase">Mañana</button>
                  <button type="button" onClick={() => {setHoraInicio('15:00'); setHoraFin('22:00');}} className="flex-1 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold py-2 rounded-xl transition-colors cursor-pointer border border-transparent uppercase">Tarde</button>
                  <button type="button" onClick={() => {setHoraInicio('22:00'); setHoraFin('06:00');}} className="flex-1 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-bold py-2 rounded-xl transition-colors cursor-pointer border border-transparent uppercase">Noche</button>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden flex-1 focus-within:ring-2 focus-within:ring-blue-500 transition-all shadow-sm">
                    <select value={horaInicio.split(':')[0]} onChange={(e) => setHoraInicio(`${e.target.value}:${horaInicio.split(':')[1]}`)} className="bg-transparent p-3 text-sm font-extrabold text-gray-800 dark:text-white outline-none cursor-pointer appearance-none text-center w-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                      {horasArray.map(h => <option key={`h-ini-${h}`} value={h}>{h}</option>)}
                    </select>
                    <span className="text-gray-400 font-bold">:</span>
                    <select value={horaInicio.split(':')[1]} onChange={(e) => setHoraInicio(`${horaInicio.split(':')[0]}:${e.target.value}`)} className="bg-transparent p-3 text-sm font-extrabold text-gray-800 dark:text-white outline-none cursor-pointer appearance-none text-center w-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                      {minutosArray.map(m => <option key={`m-ini-${m}`} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <span className="text-gray-400 font-bold">-</span>
                  <div className="flex items-center bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden flex-1 focus-within:ring-2 focus-within:ring-blue-500 transition-all shadow-sm">
                    <select value={horaFin.split(':')[0]} onChange={(e) => setHoraFin(`${e.target.value}:${horaFin.split(':')[1]}`)} className="bg-transparent p-3 text-sm font-extrabold text-gray-800 dark:text-white outline-none cursor-pointer appearance-none text-center w-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                      {horasArray.map(h => <option key={`h-fin-${h}`} value={h}>{h}</option>)}
                    </select>
                    <span className="text-gray-400 font-bold">:</span>
                    <select value={horaFin.split(':')[1]} onChange={(e) => setHoraFin(`${horaFin.split(':')[0]}:${e.target.value}`)} className="bg-transparent p-3 text-sm font-extrabold text-gray-800 dark:text-white outline-none cursor-pointer appearance-none text-center w-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                      {minutosArray.map(m => <option key={`m-fin-${m}`} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex gap-3 transition-colors duration-300">
                <button onClick={() => setShowModal(false)} className="flex-1 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm text-sm">Cancelar</button>
                <button onClick={handleGuardarTurno} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm shadow-md cursor-pointer disabled:opacity-50 transition-colors">{loading ? 'Guardando...' : 'Confirmar Turno'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR ANUNCIO (TABLÓN) */}
      {showModalAnuncio && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 transition-colors duration-300">
            <div className="bg-purple-600 p-5 text-white flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
                <h2 className="font-extrabold text-lg">Publicar en el Tablón</h2>
              </div>
              <button onClick={() => setShowModalAnuncio(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">Título del Aviso</label>
                <input type="text" placeholder="Ej. Inventario Anual, Reunión..." value={tituloAnuncio} onChange={(e) => setTituloAnuncio(e.target.value)} className="w-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-[#0f172a] p-3 rounded-xl text-sm font-medium text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">Mensaje</label>
                <textarea rows={4} placeholder="Escribe aquí la información para todos los empleados..." value={mensajeAnuncio} onChange={(e) => setMensajeAnuncio(e.target.value)} className="w-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-[#0f172a] p-3 rounded-xl text-sm font-medium text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-sm resize-none"></textarea>
              </div>
              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex gap-3 transition-colors duration-300">
                <button onClick={() => setShowModalAnuncio(false)} className="flex-1 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm text-sm">Cancelar</button>
                <button onClick={handlePublicarAnuncio} disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl text-sm shadow-md cursor-pointer disabled:opacity-50 transition-colors">{loading ? 'Enviando...' : 'Publicar Aviso'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLES DEL DÍA */}
      {diaModalSeleccionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fade-in" onClick={() => setDiaModalSeleccionado(null)}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-colors duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-blue-600 p-5 text-white flex justify-between items-center shadow-sm">
              <div>
                <h2 className="font-extrabold text-lg">Turnos del Día</h2>
                <p className="text-blue-100 text-sm">{diaModalSeleccionado.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <button onClick={() => setDiaModalSeleccionado(null)} className="text-white/80 hover:text-white cursor-pointer bg-blue-700/50 hover:bg-blue-700 p-2 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {getTurnosParaElDia(diaModalSeleccionado).length > 0 ? (
                getTurnosParaElDia(diaModalSeleccionado).map(turno => (
                  <div key={turno.id_turno} className="bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-4 shadow-sm relative group transition-colors duration-300">
                    <button onClick={() => setElementoAEliminar({ tipo: 'unico', idTurno: turno.id_turno })} className="absolute top-4 right-4 bg-red-100 hover:bg-red-200 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 p-2 rounded-lg transition-colors cursor-pointer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold px-3 py-1 rounded-lg text-sm border border-blue-200 dark:border-blue-500/30 transition-colors duration-300">
                        {turno.hora_inicio.substring(0,5)} - {turno.hora_fin.substring(0,5)}
                      </span>
                    </div>
                    <div className="space-y-2 pr-10">
                      {turno.usuarios.map((u, idx) => (
                        <div key={idx} className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">{u.nombre.substring(0,2).toUpperCase()}</div>
                          <span className="font-bold text-gray-800 dark:text-white text-sm transition-colors duration-300">{u.nombre}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-slate-400 font-bold transition-colors duration-300">No hay nadie asignado este día</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 flex gap-3 transition-colors duration-300">
              <button onClick={() => setElementoAEliminar({ tipo: 'dia', fecha: diaModalSeleccionado })} className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold py-3 rounded-xl border border-red-200 dark:border-red-900/50 transition-colors cursor-pointer shadow-sm text-sm uppercase">Borrar todo el día</button>
              <button onClick={() => setDiaModalSeleccionado(null)} className="flex-1 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm text-sm uppercase">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALES ADICIONALES */}
      {showModalBorrar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowModalBorrar(false)}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col transition-colors duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center transition-colors duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 transition-colors duration-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </div>
                <div><h2 className="text-xl font-extrabold text-gray-800 dark:text-white transition-colors duration-300">Borrado Masivo</h2></div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 transition-colors duration-300">Seleccionar Empleado</label>
                <select value={borrarEmpleado} onChange={(e) => setBorrarEmpleado(e.target.value)} className="w-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-[#0f172a] p-3 rounded-xl text-sm font-medium text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-red-500 transition-all shadow-sm cursor-pointer">
                  <option value="">Elegir de la plantilla...</option>
                  {empleados.map(emp => <option key={emp.id_usuario} value={emp.id_usuario}>{emp.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><input type="date" value={borrarFechaInicio} onChange={(e) => setBorrarFechaInicio(e.target.value)} className="w-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-[#0f172a] p-3 rounded-xl text-sm font-medium text-gray-800 dark:text-white" /></div>
                <div><input type="date" value={borrarFechaFin} onChange={(e) => setBorrarFechaFin(e.target.value)} className="w-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-[#0f172a] p-3 rounded-xl text-sm font-medium text-gray-800 dark:text-white" /></div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 flex gap-3 transition-colors duration-300">
              <button onClick={() => setShowModalBorrar(false)} className="flex-1 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm text-sm">Cancelar</button>
              <button onClick={handleBorrarMasivo} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-md text-sm disabled:opacity-50">{loading ? 'Borrando...' : 'Confirmar y Borrar'}</button>
            </div>
          </div>
        </div>
      )}

      {showModalAlertas && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fade-in" onClick={() => setShowModalAlertas(false)}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-orange-500 p-5 text-white flex justify-between items-center shadow-sm">
              <div><h2 className="font-extrabold text-xl">Alertas de Planificación</h2></div>
              <button onClick={() => setShowModalAlertas(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors cursor-pointer"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-gray-50 dark:bg-[#0f172a]">
              {alertasPlanificacion.map(alerta => (
                <div key={alerta.id_usuario} className={`bg-white dark:bg-[#1e293b] border rounded-xl p-4 flex items-center justify-between shadow-sm transition-colors ${alerta.nivel === 'critico' ? 'border-red-200 dark:border-red-900/50' : 'border-orange-200 dark:border-orange-900/50'}`}>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-base">{alerta.nombre}</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Último turno: <span className="font-bold text-gray-700 dark:text-gray-300">{alerta.ultimaFecha}</span></p>
                  </div>
                  <button onClick={() => { setShowModalAlertas(false); setSelectedEmpleado(alerta.id_usuario); setDiasSeleccionados([]); setShowModal(true); }} className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-bold py-2.5 px-5 rounded-xl cursor-pointer text-xs shadow-sm">Programar</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showModalSolicitudes && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fade-in" onClick={() => setShowModalSolicitudes(false)}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-orange-500 p-5 text-white flex justify-between items-center shadow-sm">
              <div><h2 className="font-extrabold text-xl">Solicitudes</h2></div>
              <button onClick={() => setShowModalSolicitudes(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors cursor-pointer"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-gray-50 dark:bg-[#0f172a] transition-colors duration-300">
              {solicitudes.length > 0 ? (
                solicitudes.map(sol => (
                  <div key={sol.id_solicitud} className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 rounded-xl p-5 shadow-sm transition-colors duration-300">
                    <h3 className="font-bold text-gray-800 dark:text-white text-base transition-colors duration-300">{sol.usuarios.nombre}</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 border-b border-gray-100 dark:border-slate-700 pb-4 transition-colors duration-300">Desea el <span className="font-bold text-orange-600 dark:text-[#ff7b00]">{new Date(sol.fecha_solicitada).toLocaleDateString('es-ES')}</span> libre</p>
                    {solicitudARechazar === sol.id_solicitud ? (
                      <div className="animate-fade-in">
                        <input type="text" placeholder="Ej: Necesitamos personal..." value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)} className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-[#0f172a] p-3 rounded-lg text-sm mb-4" />
                        <div className="flex gap-3">
                          <button onClick={() => setSolicitudARechazar(null)} className="flex-1 bg-gray-200 text-gray-700 text-sm font-bold py-2.5 rounded-lg cursor-pointer">Cancelar</button>
                          <button onClick={() => gestionarSolicitud(sol.id_solicitud, sol.usuarios.id_usuario, sol.fecha_solicitada, 'rechazada')} className="flex-1 bg-red-600 text-white text-sm font-bold py-2.5 rounded-lg cursor-pointer">Rechazar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button onClick={() => gestionarSolicitud(sol.id_solicitud, sol.usuarios.id_usuario, sol.fecha_solicitada, 'aprobada')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold transition-colors cursor-pointer text-sm shadow-sm">Aprobar</button>
                        <button onClick={() => setSolicitudARechazar(sol.id_solicitud)} className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 py-2.5 rounded-lg font-bold transition-colors cursor-pointer text-sm shadow-sm">Rechazar</button>
                      </div>
                    )}
                  </div>
                ))
              ) : (<div className="text-center py-8"><p className="text-gray-500 font-bold">No hay solicitudes.</p></div>)}
            </div>
          </div>
        </div>
      )}

      {elementoAEliminar && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4"><div className="bg-white dark:bg-[#1e293b] rounded-2xl w-full max-w-sm p-6 text-center"><h2 className="text-xl font-extrabold text-gray-800 dark:text-white mb-6">¿Confirmar borrado?</h2><div className="flex gap-3"><button onClick={() => setElementoAEliminar(null)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl text-sm">Cancelar</button><button onClick={confirmarEliminacion} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl text-sm">Sí, eliminar</button></div></div></div>
      )}

      {alerta && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[400] p-4"><div className="bg-white dark:bg-[#1e293b] rounded-2xl w-full max-w-sm p-6 text-center"><h2 className="text-xl font-extrabold text-gray-800 dark:text-white mb-2">{alerta.titulo}</h2><p className="text-gray-500 dark:text-slate-400 text-sm mb-6">{alerta.texto}</p><button onClick={() => setAlerta(null)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">Aceptar</button></div></div>
      )}
    </div>
  );
}