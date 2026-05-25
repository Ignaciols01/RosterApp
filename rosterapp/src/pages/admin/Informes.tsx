import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Fichaje {
  id_fichaje: string;
  hora_entrada: string;
  hora_salida: string | null;
  usuarios: {
    id_usuario: string;
    nombre: string;
  };
}

export default function AdminInformes() {
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [empleados, setEmpleados] = useState<{id_usuario: string, nombre: string}[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const mesActual = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const [filtroMes, setFiltroMes] = useState(mesActual);
  const [filtroEmpleado, setFiltroEmpleado] = useState('todos');

  useEffect(() => {
    cargarFichajes();
    cargarEmpleados();
  }, [filtroMes, filtroEmpleado]); // Recargar si cambian los filtros

  const cargarEmpleados = async () => {
    const { data } = await supabase.from('usuarios').select('id_usuario, nombre').eq('rol', 'empleado');
    if (data) setEmpleados(data);
  };

  const cargarFichajes = async () => {
    setLoading(true);
    let query = supabase
      .from('fichajes')
      .select(`
        id_fichaje,
        hora_entrada,
        hora_salida,
        usuarios ( id_usuario, nombre )
      `)
      .gte('hora_entrada', `${filtroMes}-01T00:00:00Z`)
      .lte('hora_entrada', `${filtroMes}-31T23:59:59Z`)
      .order('hora_entrada', { ascending: false });

    if (filtroEmpleado !== 'todos') {
      query = query.eq('id_usuario', filtroEmpleado);
    }

    const { data, error } = await query;

    if (!error && data) {
      setFichajes(data as unknown as Fichaje[]);
    }
    setLoading(false);
  };

  const calcularDuracion = (entrada: string, salida: string | null) => {
    if (!salida) return '-';
    const diff = new Date(salida).getTime() - new Date(entrada).getTime();
    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${horas}h ${minutos}m`;
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 dark:bg-[#0f172a] min-h-[calc(100vh-80px)] transition-colors duration-300 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-blue-700 dark:text-blue-400">Informes de Fichaje</h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-slate-400 mt-1 font-medium">Control de horas trabajadas y registros.</p>
        </div>
        
        {/* Controles de Filtro */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="month" 
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <select 
            value={filtroEmpleado}
            onChange={(e) => setFiltroEmpleado(e.target.value)}
            className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
          >
            <option value="todos">Todos los empleados</option>
            {empleados.map(emp => (
              <option key={emp.id_usuario} value={emp.id_usuario}>{emp.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-slate-400 font-bold animate-pulse">
            Cargando registros...
          </div>
        ) : fichajes.length > 0 ? (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                  {/* Aplico whitespace-nowrap para que no se aplaste en móvil */}
                  <th className="p-4 font-extrabold text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400 whitespace-nowrap">Empleado</th>
                  <th className="p-4 font-extrabold text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400 whitespace-nowrap text-center">Entrada</th>
                  <th className="p-4 font-extrabold text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400 whitespace-nowrap text-center">Salida</th>
                  <th className="p-4 font-extrabold text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400 whitespace-nowrap text-right">Tiempo Total</th>
                </tr>
              </thead>
              <tbody>
                {fichajes.map((fichaje) => (
                  <tr key={fichaje.id_fichaje} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50/80 dark:hover:bg-slate-800/80 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shadow-inner flex-shrink-0">
                          {fichaje.usuarios?.nombre?.substring(0, 2).toUpperCase()}
                        </div>
                        {/* El nombre también en una sola línea */}
                        <p className="font-bold text-gray-800 dark:text-gray-200 text-sm whitespace-nowrap">
                          {fichaje.usuarios?.nombre}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <span className="bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 py-1 px-3 rounded-lg text-sm font-bold shadow-sm">
                        {new Date(fichaje.hora_entrada).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 font-medium">{new Date(fichaje.hora_entrada).toLocaleDateString('es-ES')}</p>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      {fichaje.hora_salida ? (
                        <>
                          <span className="bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 py-1 px-3 rounded-lg text-sm font-bold shadow-sm">
                            {new Date(fichaje.hora_salida).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 font-medium">{new Date(fichaje.hora_salida).toLocaleDateString('es-ES')}</p>
                        </>
                      ) : (
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-500 bg-orange-100 dark:bg-orange-500/10 px-2 py-1 rounded-md">En Curso</span>
                      )}
                    </td>
                    <td className="p-4 text-right text-sm font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {calcularDuracion(fichaje.hora_entrada, fichaje.hora_salida)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-4 text-gray-400 dark:text-slate-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01-.293.707H11a2 2 0 01-2-2v-5z"></path></svg>
            </div>
            <p className="text-gray-500 dark:text-slate-400 font-bold">No hay registros para las fechas seleccionadas.</p>
          </div>
        )}
      </div>
    </div>
  );
}