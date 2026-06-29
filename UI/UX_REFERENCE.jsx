import React, { useState, useEffect } from 'react';
import { 
  Home, Users, User, FileText, ClipboardList, Activity, Settings, 
  LogOut, Search, Plus, Edit, Trash2, Mic, CheckCircle, Clock, AlertCircle, 
  X, ChevronRight, ChevronLeft, Save, UserPlus, FilePlus, Shield, 
  List, Calendar, CheckSquare, Stethoscope, FileDigit, Download, AlertTriangle
} from 'lucide-react';

// --- CONSTANTS & MOCK DATA ---
const ROLES = {
  ADMIN: 'ADMIN',
  DOCTOR: 'MEDICO',
  ASSISTANT: 'ASISTENTE'
};

const MOCK_USERS = [
  { id: 1, name: 'Dra. Elena Ramos', email: 'medico@anamneo.cl', role: ROLES.DOCTOR, active: true },
  { id: 2, name: 'Admin General', email: 'admin@anamneo.cl', role: ROLES.ADMIN, active: true },
  { id: 3, name: 'Asist. Carlos Soto', email: 'asistente@anamneo.cl', role: ROLES.ASSISTANT, active: true, assignedDoctorId: 1 },
];

const MOCK_PATIENTS = [
  { id: 1, rut: '15.123.456-7', name: 'Juan Pérez González', dob: '1985-05-15', gender: 'Masculino', phone: '+56912345678', address: 'Las Araucarias 123', status: 'Activo', bg: 'Hipertensión familiar' },
  { id: 2, rut: '18.987.654-3', name: 'María Silva Ríos', dob: '1992-10-20', gender: 'Femenino', phone: '+56987654321', address: 'Av. Providencia 456', status: 'Activo', bg: 'Sin antecedentes relevantes' },
  { id: 3, rut: 'NO-RUT-1', name: 'Turista Extranjero', dob: '1980-01-01', gender: 'Otro', noRutReason: 'Pasaporte extranjero', status: 'Activo', bg: '' }
];

const MOCK_PROBLEMS = [
  { id: 1, patientId: 1, name: 'Hipertensión Arterial', status: 'Crónico', severity: 'Moderada', startDate: '2020-01-15', notes: 'Controlado con Enalapril' }
];

const MOCK_FOLLOWUPS = [
  { id: 1, patientId: 2, type: 'Examen', description: 'Traer resultados Perfil Lipídico', dueDate: '2026-04-10', status: 'Pendiente' }
];

const WIZARD_SECTIONS = [
  { id: 'identificacion', label: 'Identificación' },
  { id: 'motivo', label: 'Motivo de consulta' },
  { id: 'anamnesisProxima', label: 'Anamnesis Próxima' },
  { id: 'anamnesisRemota', label: 'Anamnesis Remota' },
  { id: 'revisionSistemas', label: 'Revisión por Sistemas' },
  { id: 'examenFisico', label: 'Examen Físico' },
  { id: 'sospechaDiagnostica', label: 'Sospecha Diagnóstica' },
  { id: 'tratamiento', label: 'Tratamiento' },
  { id: 'respuestaTratamiento', label: 'Respuesta al Trat.' },
  { id: 'observaciones', label: 'Observaciones' }
];

// --- HELPER COMPONENTS ---

const Badge = ({ children, variant = 'gray' }) => {
  const colors = {
    gray: 'bg-[#e5e4e0] text-[#404040]',
    blue: 'bg-[#d6e4ff] text-[#1d3978]',
    green: 'bg-[#d1f4e0] text-[#1a5d38]',
    yellow: 'bg-[#eaf832] text-[#2b2b2b]', // Acento amarillo de tu diseño
    red: 'bg-[#fcd5d5] text-[#7f1d1d]',
    purple: 'bg-[#e8d8fc] text-[#4a1d82]',
    dark: 'bg-[#404040] text-white',
  };
  return (
    <span className={`px-3 py-1 inline-flex text-xs font-bold rounded-full ${colors[variant] || colors.gray}`}>
      {children}
    </span>
  );
};

const Button = ({ children, onClick, variant = 'primary', icon: Icon, className = '', disabled = false }) => {
  // Pill-shaped buttons based on the reference design
  const baseStyle = "inline-flex items-center justify-center px-5 py-2.5 text-sm font-bold rounded-full focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "border-transparent text-white bg-[#404040] hover:bg-[#2b2b2b]", // Gris oscuro carbol
    accent: "border-transparent text-[#2b2b2b] bg-[#eaf832] hover:bg-[#d6e32d]", // Amarillo lima
    secondary: "border-transparent text-[#404040] bg-white hover:bg-[#f0eee9]", // Blanco/Pill
    danger: "border-transparent text-white bg-red-600 hover:bg-red-700",
    ghost: "border-transparent text-[#404040] bg-transparent hover:bg-[#e5e4e0]"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {Icon && <Icon className="mr-2 h-4 w-4" />}
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-[#fdfcfb] rounded-[2rem] shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

// --- MAIN APPLICATION ---

export default function AnamneoApp() {
  // Global State (Mock DB)
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [routeParams, setRouteParams] = useState({});
  
  const [db, setDb] = useState({
    users: MOCK_USERS,
    patients: MOCK_PATIENTS,
    problems: MOCK_PROBLEMS,
    followups: MOCK_FOLLOWUPS,
    consultations: [],
    auditLogs: [{ id: 1, action: 'Sistema Iniciado', user: 'System', timestamp: new Date().toISOString(), details: 'Base de datos en memoria lista.' }]
  });

  // Database actions
  const logAudit = (action, details) => {
    setDb(prev => ({
      ...prev,
      auditLogs: [{ id: Date.now(), action, user: currentUser?.name || 'Sistema', timestamp: new Date().toISOString(), details }, ...prev.auditLogs]
    }));
  };

  const addPatient = (patientData) => {
    const newPatient = { ...patientData, id: Date.now(), status: 'Activo' };
    setDb(prev => ({ ...prev, patients: [...prev.patients, newPatient] }));
    logAudit('Paciente Creado', `RUT: ${newPatient.rut || 'Sin RUT'}`);
    return newPatient;
  };

  const startConsultation = (patientId) => {
    const existing = db.consultations.find(c => c.patientId === patientId && c.status === 'En progreso');
    if (existing) {
      if(window.confirm("Ya existe una atención en progreso para este paciente. ¿Desea retomarla?")) {
        navigate('consultationWizard', { id: existing.id });
        return;
      }
    }

    const newCons = {
      id: Date.now(),
      patientId,
      doctorId: currentUser.id,
      date: new Date().toISOString(),
      status: 'En progreso',
      data: {}
    };
    setDb(prev => ({ ...prev, consultations: [...prev.consultations, newCons] }));
    logAudit('Atención Iniciada', `Paciente ID: ${patientId}`);
    navigate('consultationWizard', { id: newCons.id });
  };

  const updateConsultation = (id, data, status = 'En progreso') => {
    setDb(prev => ({
      ...prev,
      consultations: prev.consultations.map(c => c.id === id ? { ...c, data: { ...c.data, ...data }, status } : c)
    }));
  };

  // Navigation
  const navigate = (route, params = {}) => {
    setCurrentRoute(route);
    setRouteParams(params);
    window.scrollTo(0,0);
  };

  // --- VIEWS ---

  const LoginView = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#ebe9e4] py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center items-center text-[#404040] mb-2">
            <Activity className="h-12 w-12" />
          </div>
          <h2 className="text-center text-3xl font-extrabold text-[#2b2b2b]">Anamneo</h2>
          <p className="mt-2 text-center text-sm text-[#666]">Historia Clínica Electrónica Ambulatoria</p>
        </div>
        <div className="space-y-4">
          <p className="text-sm font-medium text-[#404040] text-center mb-4">Selecciona un rol de prueba:</p>
          {MOCK_USERS.map(u => (
            <button
              key={u.id}
              onClick={() => {
                setCurrentUser(u);
                logAudit('Inicio de Sesión', `Rol: ${u.role}`);
                navigate('dashboard');
              }}
              className="w-full flex justify-between items-center px-6 py-4 rounded-[1.5rem] bg-[#f5f4f0] hover:bg-[#eaf832] focus:outline-none transition-all group"
            >
              <div className="flex flex-col text-left">
                <span className="font-bold text-[#2b2b2b]">{u.name}</span>
                <span className="text-xs text-[#666] group-hover:text-[#404040]">{u.email}</span>
              </div>
              <Badge variant={u.role === ROLES.ADMIN ? 'dark' : u.role === ROLES.DOCTOR ? 'gray' : 'white'}>{u.role}</Badge>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );

  const DashboardAdmin = () => (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-[#2b2b2b]">Dashboard Operativo</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex items-center space-x-4">
          <div className="p-4 rounded-full bg-[#f0eee9] text-[#404040]"><Users className="h-6 w-6" /></div>
          <div><p className="text-sm text-[#666] font-medium">Pacientes Totales</p><p className="text-3xl font-bold text-[#2b2b2b]">{db.patients.length}</p></div>
        </Card>
        <Card className="flex items-center space-x-4">
          <div className="p-4 rounded-full bg-[#f0eee9] text-[#404040]"><Shield className="h-6 w-6" /></div>
          <div><p className="text-sm text-[#666] font-medium">Usuarios Activos</p><p className="text-3xl font-bold text-[#2b2b2b]">{db.users.length}</p></div>
        </Card>
        <Card className="flex items-center space-x-4 bg-[#eaf832]">
          <div className="p-4 rounded-full bg-white text-[#2b2b2b]"><Activity className="h-6 w-6" /></div>
          <div><p className="text-sm text-[#666] font-medium">Atenciones Hoy</p><p className="text-3xl font-bold text-[#2b2b2b]">{db.consultations.length}</p></div>
        </Card>
      </div>
      
      <Card className="p-0 overflow-hidden">
        <div className="px-8 py-6 border-b border-[#eeebe5]"><h3 className="text-xl font-bold text-[#2b2b2b]">Accesos Rápidos Administrativos</h3></div>
        <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          <Button variant="secondary" icon={Users} onClick={() => navigate('users')} className="h-32 flex-col rounded-[2rem] bg-[#f5f4f0]">Gestión Usuarios</Button>
          <Button variant="secondary" icon={List} onClick={() => navigate('audit')} className="h-32 flex-col rounded-[2rem] bg-[#f5f4f0]">Auditoría</Button>
          <Button variant="secondary" icon={Settings} onClick={() => navigate('settings')} className="h-32 flex-col rounded-[2rem] bg-[#f5f4f0]">Ajustes Sistema</Button>
          <Button variant="secondary" icon={FileText} onClick={() => navigate('patients')} className="h-32 flex-col rounded-[2rem] bg-[#f5f4f0]">Padrón Pacientes</Button>
        </div>
      </Card>
    </div>
  );

  const DashboardClinical = () => {
    const myPatients = db.patients.length; 
    const myPendings = db.followups.filter(f => f.status === 'Pendiente').length;
    const myConsultations = db.consultations.filter(c => c.doctorId === currentUser.id && c.status === 'En progreso').length;

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-[#2b2b2b]">Hola, {currentUser.name.split(' ')[0]}</h2>
          <Button variant="accent" icon={Plus} onClick={() => navigate('patients')}>Nueva Atención</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className={myConsultations > 0 ? "bg-[#eaf832]" : ""}>
            <h3 className="text-sm font-bold text-[#666] mb-2">Carga Activa</h3>
            <div className="flex items-end space-x-2">
              <span className="text-5xl font-extrabold text-[#2b2b2b]">{myConsultations}</span>
              <span className="text-[#666] mb-1 font-medium">atenciones en curso</span>
            </div>
          </Card>
          <Card className="cursor-pointer hover:bg-[#f5f4f0] transition-colors" onClick={() => navigate('followups')}>
            <h3 className="text-sm font-bold text-[#666] mb-2">Seguimientos Próximos</h3>
            <div className="flex items-end space-x-2">
              <span className="text-5xl font-extrabold text-[#2b2b2b]">{myPendings}</span>
              <span className="text-[#666] mb-1 font-medium">tareas pendientes</span>
            </div>
          </Card>
           <Card>
            <h3 className="text-sm font-bold text-[#666] mb-2">Pacientes en Padrón</h3>
            <div className="flex items-end space-x-2">
              <span className="text-5xl font-extrabold text-[#2b2b2b]">{myPatients}</span>
              <span className="text-[#666] mb-1 font-medium">registrados</span>
            </div>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="px-8 py-6 border-b border-[#eeebe5] flex justify-between items-center">
            <h3 className="text-xl font-bold text-[#2b2b2b]">Atenciones Recientes</h3>
            <Button variant="ghost" icon={ChevronRight} onClick={() => navigate('consultations')}>Ver todas</Button>
          </div>
          <div className="p-0 overflow-x-auto">
             <table className="min-w-full">
                <thead className="bg-[#fcfbfa] border-b border-[#eeebe5]">
                  <tr>
                    <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase tracking-wider">Fecha</th>
                    <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase tracking-wider">Paciente</th>
                    <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase tracking-wider">Estado</th>
                    <th className="px-8 py-4 text-right text-xs font-bold text-[#666] uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eeebe5]">
                  {db.consultations.slice(0,5).length === 0 ? (
                    <tr><td colSpan="4" className="px-8 py-8 text-center text-sm text-[#666]">No hay atenciones recientes</td></tr>
                  ) : (
                    db.consultations.slice(0,5).map(c => {
                      const p = db.patients.find(pat => pat.id === c.patientId);
                      return (
                        <tr key={c.id} className="hover:bg-[#f5f4f0] transition-colors">
                          <td className="px-8 py-5 whitespace-nowrap text-sm text-[#666]">{new Date(c.date).toLocaleDateString()}</td>
                          <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-[#2b2b2b]">{p?.name || 'Desconocido'}</td>
                          <td className="px-8 py-5 whitespace-nowrap"><Badge variant={c.status === 'Completada' ? 'gray' : 'yellow'}>{c.status}</Badge></td>
                          <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-medium">
                            <Button variant="secondary" onClick={() => navigate('consultationWizard', {id: c.id})}>Abrir</Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
          </div>
        </Card>
      </div>
    );
  }

  const PatientListView = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const filtered = db.patients.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.rut && p.rut.includes(searchTerm)));

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-[#2b2b2b]">Padrón de Pacientes</h2>
          <Button variant="accent" icon={UserPlus} onClick={() => navigate('patientForm')}>Alta Paciente</Button>
        </div>

        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-[#666] h-5 w-5" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o RUT..." 
              className="w-full pl-12 pr-6 py-4 bg-white border-none rounded-full shadow-sm focus:ring-2 focus:ring-[#eaf832] font-medium text-[#2b2b2b]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {currentUser.role === ROLES.ADMIN && <Button variant="secondary" icon={Download} className="px-6">Exportar</Button>}
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#fcfbfa] border-b border-[#eeebe5]">
                <tr>
                  <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase tracking-wider">Identificación</th>
                  <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase tracking-wider">Nombre</th>
                  <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase tracking-wider">Edad</th>
                  <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase tracking-wider">Estado</th>
                  <th className="px-8 py-4 text-right text-xs font-bold text-[#666] uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eeebe5]">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-[#f5f4f0] transition-colors">
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-[#666]">{p.rut || <span className="italic opacity-50">{p.noRutReason}</span>}</td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-[#2b2b2b]">{p.name}</td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-[#666]">{new Date().getFullYear() - new Date(p.dob).getFullYear()} años</td>
                    <td className="px-8 py-5 whitespace-nowrap"><Badge variant={p.status === 'Activo' ? 'gray' : 'red'}>{p.status}</Badge></td>
                    <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button variant="secondary" onClick={() => navigate('patientDetail', {id: p.id})}>Ficha</Button>
                      {(currentUser.role === ROLES.DOCTOR || currentUser.role === ROLES.ASSISTANT) && (
                        <Button variant="accent" onClick={() => startConsultation(p.id)}>Atender</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const PatientDetailView = () => {
    const patient = db.patients.find(p => p.id === routeParams.id);
    const [activeTab, setActiveTab] = useState('resumen');
    
    if (!patient) return <div>Paciente no encontrado</div>;

    const pProblems = db.problems.filter(p => p.patientId === patient.id);
    const pConsultations = db.consultations.filter(c => c.patientId === patient.id);
    const pFollowups = db.followups.filter(f => f.patientId === patient.id);

    return (
      <div className="space-y-6">
        {/* Header - Pill/Card Style */}
        <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center space-x-6">
            <div className="h-20 w-20 bg-[#f0eee9] rounded-full flex items-center justify-center text-[#404040] text-3xl font-bold">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-3xl font-extrabold text-[#2b2b2b]">{patient.name}</h2>
                <Badge variant={patient.status === 'Activo' ? 'yellow' : 'gray'}>{patient.status}</Badge>
              </div>
              <div className="text-sm font-medium text-[#666] flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                <span>RUT: {patient.rut || patient.noRutReason}</span>
                <span>•</span>
                <span>{new Date().getFullYear() - new Date(patient.dob).getFullYear()} años</span>
                <span>•</span>
                <span>{patient.gender}</span>
              </div>
            </div>
          </div>
          <div className="flex space-x-3 w-full md:w-auto">
            <Button variant="secondary" icon={Edit}>Editar</Button>
            {(currentUser.role === ROLES.DOCTOR) && (
              <Button variant="accent" icon={Stethoscope} onClick={() => startConsultation(patient.id)}>Atender</Button>
            )}
          </div>
        </Card>

        {/* Tabs - Pill style */}
        <div className="flex space-x-3 overflow-x-auto py-2 no-scrollbar">
          {['resumen', 'atenciones', 'problemas', 'seguimientos'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-full font-bold text-sm capitalize transition-colors whitespace-nowrap ${
                activeTab === tab 
                ? 'bg-[#404040] text-white' 
                : 'bg-white text-[#404040] hover:bg-[#f5f4f0] shadow-sm'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="pt-2">
          {activeTab === 'resumen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <h3 className="text-lg font-bold text-[#2b2b2b] mb-4">Antecedentes Persistentes</h3>
                <div className="bg-[#f5f4f0] p-6 rounded-[1.5rem] mb-4">
                  <p className="text-sm font-medium text-[#404040] whitespace-pre-wrap leading-relaxed">{patient.bg || 'Sin registro de antecedentes.'}</p>
                </div>
                <Button variant="secondary" icon={Edit} className="text-sm">Actualizar</Button>
              </Card>
              <div className="space-y-6">
                <Card>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-[#2b2b2b]">Problemas Activos</h3>
                  </div>
                  <ul className="space-y-3">
                    {pProblems.slice(0,3).map(pr => (
                      <li key={pr.id} className="flex justify-between items-center p-4 bg-[#f5f4f0] rounded-[1.5rem]">
                        <span className="font-bold text-[#2b2b2b] text-sm">{pr.name}</span> 
                        <Badge variant="dark">{pr.status}</Badge>
                      </li>
                    ))}
                    {pProblems.length === 0 && <p className="text-sm font-medium text-[#666] p-4">No hay problemas registrados.</p>}
                  </ul>
                </Card>
                <Card>
                  <h3 className="text-lg font-bold text-[#2b2b2b] mb-4">Próximos Seguimientos</h3>
                   <ul className="space-y-3">
                    {pFollowups.filter(f=>f.status==='Pendiente').slice(0,3).map(f => (
                      <li key={f.id} className="flex justify-between items-center p-4 bg-[#f5f4f0] rounded-[1.5rem] text-sm">
                        <span className="font-bold text-[#404040] flex items-center gap-2"><Clock className="w-4 h-4"/> {f.type}</span> 
                        <span className="text-[#2b2b2b] font-bold bg-white px-3 py-1 rounded-full">{f.dueDate}</span>
                      </li>
                    ))}
                     {pFollowups.length === 0 && <p className="text-sm font-medium text-[#666] p-4">Sin seguimientos pendientes.</p>}
                  </ul>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'atenciones' && (
            <Card>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#2b2b2b]">Timeline de Atenciones</h3>
              </div>
              <div className="space-y-4">
                {pConsultations.length === 0 ? <p className="text-[#666] font-medium">El paciente no tiene atenciones registradas.</p> : pConsultations.map(c => (
                  <div key={c.id} className="flex items-center space-x-4 p-5 bg-[#f5f4f0] rounded-[1.5rem] hover:bg-[#eaf832] transition-colors cursor-pointer group" onClick={() => navigate('consultationWizard', {id: c.id})}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-base font-bold text-[#2b2b2b]">Atención • {new Date(c.date).toLocaleDateString()}</p>
                        <Badge variant={c.status === 'Completada' ? 'dark' : 'yellow'}>{c.status}</Badge>
                      </div>
                      <p className="text-sm font-medium text-[#666] group-hover:text-[#404040] line-clamp-2">Motivo: {c.data?.motivo || 'No especificado'}</p>
                    </div>
                    <ChevronRight className="h-6 w-6 text-[#404040]" />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'problemas' && (
            <Card className="p-0 overflow-hidden">
               <div className="flex justify-between items-center p-6 border-b border-[#eeebe5]">
                <h3 className="text-xl font-bold text-[#2b2b2b]">Lista de Problemas</h3>
                <Button variant="secondary" icon={Plus}>Añadir</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-[#fcfbfa]">
                    <tr>
                      <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase">Problema</th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase">Estado</th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase">Inicio</th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eeebe5]">
                    {pProblems.map(pr => (
                      <tr key={pr.id} className="hover:bg-[#f5f4f0] transition-colors">
                        <td className="px-8 py-5 text-sm font-bold text-[#2b2b2b]">{pr.name}</td>
                        <td className="px-8 py-5 text-sm"><Badge variant="gray">{pr.status}</Badge></td>
                        <td className="px-8 py-5 text-sm font-medium text-[#666]">{pr.startDate}</td>
                        <td className="px-8 py-5 text-sm font-medium text-[#666] truncate max-w-xs">{pr.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

           {activeTab === 'seguimientos' && (
            <Card>
               <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#2b2b2b]">Seguimientos y Tareas</h3>
                <Button variant="secondary" icon={Plus}>Añadir</Button>
              </div>
              <div className="space-y-4">
                {pFollowups.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-5 bg-[#f5f4f0] rounded-[1.5rem]">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-full text-[#404040] shadow-sm"><CheckSquare className="w-5 h-5" /></div>
                      <div>
                        <p className="font-bold text-base text-[#2b2b2b]">{f.type}: {f.description}</p>
                        <p className="text-sm font-medium text-[#666] mt-1">Vence: {f.dueDate}</p>
                      </div>
                    </div>
                    <Badge variant={f.status === 'Pendiente' ? 'yellow' : 'gray'}>{f.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  };

  const ConsultationWizardView = () => {
    const consultation = db.consultations.find(c => c.id === routeParams.id);
    const patient = db.patients.find(p => p.id === consultation?.patientId);
    
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [localData, setLocalData] = useState(consultation?.data || {});
    const [saveStatus, setSaveStatus] = useState('Guardado');

    useEffect(() => {
      if(consultation && consultation.status !== 'Completada') {
        setSaveStatus('Guardando...');
        const timer = setTimeout(() => {
          updateConsultation(consultation.id, localData, 'En progreso');
          setSaveStatus('Guardado');
        }, 1000);
        return () => clearTimeout(timer);
      }
    }, [localData]);

    if (!consultation || !patient) return <div>Atención no encontrada</div>;

    const isCompleted = consultation.status === 'Completada';
    const section = WIZARD_SECTIONS[currentSectionIndex];

    const handleDictation = () => {
      const mockText = " Paciente refiere dolor abdominal de 3 días de evolución, intensidad 6 de 10, no irradiado. ";
      setLocalData(prev => ({
        ...prev,
        [section.id]: (prev[section.id] || '') + mockText
      }));
    };

    const markCompleted = () => {
      if(window.confirm("¿Está seguro de finalizar esta atención? No podrá editarla posteriormente sin permisos especiales.")) {
        updateConsultation(consultation.id, localData, 'Completada');
        logAudit('Atención Completada', `Atención ID: ${consultation.id}`);
        navigate('patientDetail', {id: patient.id});
      }
    };

    return (
      <div className="h-[calc(100vh-6rem)] flex flex-col md:flex-row gap-6">
        
        {/* Left Nav (Pill style) */}
        <div className="w-full md:w-72 flex flex-col space-y-2 overflow-y-auto no-scrollbar pb-6">
          <Card className="mb-4 bg-[#404040] text-white p-5 rounded-[2rem]">
            <h2 className="text-lg font-bold mb-1">{patient.name}</h2>
            <p className="text-sm text-[#a3a3a3] font-medium flex items-center justify-between">
              {new Date(consultation.date).toLocaleDateString()}
              {isCompleted ? <Badge variant="gray">Fin</Badge> : <Badge variant="yellow">En curso</Badge>}
            </p>
          </Card>
          
          <div className="space-y-2">
            {WIZARD_SECTIONS.map((sec, idx) => (
              <button
                key={sec.id}
                onClick={() => setCurrentSectionIndex(idx)}
                className={`w-full text-left px-5 py-4 rounded-full text-sm font-bold flex justify-between items-center transition-all ${
                  currentSectionIndex === idx 
                  ? 'bg-[#eaf832] text-[#2b2b2b] shadow-sm' 
                  : 'bg-white text-[#666] hover:bg-[#f5f4f0]'
                }`}
              >
                <span className="truncate">{sec.label}</span>
                {localData[sec.id] && localData[sec.id].trim() !== '' && <CheckCircle className={`w-4 h-4 ${currentSectionIndex === idx ? 'text-[#2b2b2b]' : 'text-[#404040]'}`} />}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <Card className="flex-1 flex flex-col relative p-0 overflow-hidden">
           <div className="flex-1 p-8 overflow-y-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h3 className="text-3xl font-bold text-[#2b2b2b]">{section.label}</h3>
                {!isCompleted && (
                  <div className="flex space-x-2">
                    <Button variant="secondary" icon={FilePlus}>Plantillas</Button>
                    <Button variant="secondary" icon={Mic} onClick={handleDictation}>Dictar</Button>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {section.id === 'sospechaDiagnostica' && !isCompleted && (
                  <div className="bg-[#f5f4f0] rounded-[1.5rem] p-5 flex gap-4 items-start">
                    <AlertCircle className="text-[#404040] w-6 h-6 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-[#2b2b2b]">Sugerencia del sistema (CIE-10)</p>
                      <p className="text-sm font-medium text-[#666] mt-1">Basado en texto previo, considere: R10.4 (Otros dolores abdominales y los no especificados).</p>
                      <button className="mt-3 text-xs font-bold bg-white text-[#404040] px-4 py-2 rounded-full shadow-sm hover:bg-[#eaf832]">Agregar diagnóstico</button>
                    </div>
                  </div>
                )}

                <textarea
                  className="w-full h-80 p-6 bg-[#f5f4f0] border-none rounded-[2rem] shadow-inner focus:ring-2 focus:ring-[#eaf832] resize-none font-medium text-[#2b2b2b] leading-relaxed"
                  placeholder={`Escriba o dicte la información para ${section.label}...`}
                  value={localData[section.id] || ''}
                  onChange={(e) => setLocalData(prev => ({...prev, [section.id]: e.target.value}))}
                  disabled={isCompleted}
                />

                {section.id === 'tratamiento' && !isCompleted && (
                  <div className="mt-6 pt-6 border-t border-[#eeebe5]">
                    <h4 className="font-bold text-[#2b2b2b] mb-4">Órdenes Estructuradas</h4>
                    <div className="flex gap-3">
                       <Button variant="secondary" icon={Plus}>Receta Médica</Button>
                       <Button variant="secondary" icon={Plus}>Orden de Examen</Button>
                    </div>
                  </div>
                )}
              </div>
           </div>

           {/* Footer Navigation */}
           <div className="bg-white border-t border-[#eeebe5] p-5 flex flex-wrap justify-between items-center gap-4 rounded-b-[2rem]">
              <div className="flex items-center space-x-3">
                 <Button 
                    variant="secondary" 
                    icon={ChevronLeft} 
                    disabled={currentSectionIndex === 0}
                    onClick={() => setCurrentSectionIndex(prev => prev - 1)}
                  >
                    Anterior
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="flex-row-reverse"
                    icon={ChevronRight} 
                    disabled={currentSectionIndex === WIZARD_SECTIONS.length - 1}
                    onClick={() => setCurrentSectionIndex(prev => prev + 1)}
                  >
                    Siguiente
                  </Button>
              </div>

              <div className="flex items-center space-x-4">
                 {!isCompleted && <span className="text-xs font-bold text-[#666] flex items-center gap-1"><Save className="w-4 h-4"/> {saveStatus}</span>}
                 <Button variant="ghost" onClick={() => navigate('patientDetail', {id: patient.id})}>Pausar</Button>
                 {!isCompleted && <Button variant="primary" icon={CheckCircle} onClick={markCompleted}>Finalizar</Button>}
              </div>
           </div>
        </Card>
      </div>
    );
  };

  const AdminAuditView = () => (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-[#2b2b2b]">Registro de Auditoría</h2>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#fcfbfa] border-b border-[#eeebe5]">
              <tr>
                <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase">Fecha/Hora</th>
                <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase">Usuario</th>
                <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase">Acción</th>
                <th className="px-8 py-4 text-left text-xs font-bold text-[#666] uppercase">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eeebe5]">
              {db.auditLogs.map(log => (
                <tr key={log.id} className="hover:bg-[#f5f4f0] transition-colors">
                  <td className="px-8 py-5 text-sm text-[#666] font-medium">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-8 py-5 text-sm font-bold text-[#2b2b2b]">{log.user}</td>
                  <td className="px-8 py-5 text-sm"><Badge variant="dark">{log.action}</Badge></td>
                  <td className="px-8 py-5 text-sm font-medium text-[#666] truncate max-w-md">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const SettingsView = () => (
    <div className="max-w-4xl space-y-8">
      <h2 className="text-3xl font-bold text-[#2b2b2b]">Ajustes Generales</h2>
      
      <Card>
        <h3 className="text-xl font-bold text-[#2b2b2b] mb-6">Perfil del Usuario</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-[#666] mb-2">Nombre</label>
            <input type="text" disabled value={currentUser.name} className="block w-full bg-[#f5f4f0] border-none rounded-full px-5 py-3 text-[#2b2b2b] font-medium" />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#666] mb-2">Correo</label>
            <input type="text" disabled value={currentUser.email} className="block w-full bg-[#f5f4f0] border-none rounded-full px-5 py-3 text-[#2b2b2b] font-medium" />
          </div>
          <div className="md:col-span-2 pt-2"><Button variant="secondary" icon={Edit}>Cambiar Contraseña</Button></div>
        </div>
      </Card>

      {currentUser.role === ROLES.ADMIN && (
        <Card className="bg-[#404040] text-white">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-3"><Settings className="w-6 h-6 text-[#eaf832]"/> Configuración Clínica</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-[#a3a3a3] mb-2">Nombre de la Clínica</label>
              <input type="text" defaultValue="Centro Médico Anamneo" className="block w-full bg-[#2b2b2b] border-none rounded-full px-5 py-3 text-white font-medium focus:ring-2 focus:ring-[#eaf832]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-[#a3a3a3] mb-2">Servidor SMTP</label>
                <input type="text" defaultValue="smtp.sendgrid.net" className="block w-full bg-[#2b2b2b] border-none rounded-full px-5 py-3 text-white font-medium focus:ring-2 focus:ring-[#eaf832]" />
              </div>
               <div>
                <label className="block text-sm font-bold text-[#a3a3a3] mb-2">Puerto SMTP</label>
                <input type="text" defaultValue="587" className="block w-full bg-[#2b2b2b] border-none rounded-full px-5 py-3 text-white font-medium focus:ring-2 focus:ring-[#eaf832]" />
              </div>
            </div>
            <div className="pt-4"><Button variant="accent">Guardar Ajustes</Button></div>
          </div>
        </Card>
      )}
    </div>
  );

  // --- LAYOUT & ROUTING LOGIC ---

  if (!currentUser) {
    return <LoginView />;
  }

  const renderContent = () => {
    switch (currentRoute) {
      case 'dashboard': return currentUser.role === ROLES.ADMIN ? <DashboardAdmin /> : <DashboardClinical />;
      case 'patients': return <PatientListView />;
      case 'patientDetail': return <PatientDetailView />;
      case 'consultationWizard': return <ConsultationWizardView />;
      case 'audit': return <AdminAuditView />;
      case 'settings': return <SettingsView />;
      default: return (
        <div className="text-center py-20">
          <AlertTriangle className="mx-auto h-16 w-16 text-[#eaf832] mb-6" />
          <h3 className="text-2xl font-bold text-[#2b2b2b]">Módulo en construcción</h3>
          <p className="mt-2 text-sm font-medium text-[#666]">La vista '{currentRoute}' aún no está implementada.</p>
          <Button className="mt-6" onClick={() => navigate('dashboard')}>Volver al inicio</Button>
        </div>
      );
    }
  };

  const navigationItems = [
    { id: 'dashboard', label: 'Inicio', icon: Home, roles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.ASSISTANT] },
    { id: 'patients', label: 'Pacientes', icon: Users, roles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.ASSISTANT] },
    { id: 'consultations', label: 'Atenciones', icon: ClipboardList, roles: [ROLES.DOCTOR, ROLES.ASSISTANT] },
    { id: 'followups', label: 'Bandeja', icon: CheckSquare, roles: [ROLES.DOCTOR, ROLES.ASSISTANT] },
    { id: 'users', label: 'Usuarios', icon: Shield, roles: [ROLES.ADMIN] },
    { id: 'audit', label: 'Auditoría', icon: List, roles: [ROLES.ADMIN] },
    { id: 'settings', label: 'Ajustes', icon: Settings, roles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.ASSISTANT] },
  ].filter(item => item.roles.includes(currentUser.role));

  return (
    <div className="flex h-screen bg-[#ebe9e4] font-sans overflow-hidden">
      
      {/* Floating Dark Sidebar based on reference */}
      <aside className="w-64 bg-[#404040] text-white hidden md:flex flex-col m-4 rounded-[2.5rem] shadow-xl overflow-hidden z-10 relative">
        <div className="h-24 flex items-center px-8">
          <Activity className="h-8 w-8 text-[#eaf832] mr-3" />
          <span className="text-2xl font-extrabold tracking-tight">Anamneo</span>
        </div>
        
        <div className="px-6 pb-6 mb-4 border-b border-[#555]">
          <div className="flex items-center space-x-4 bg-[#2b2b2b] p-3 rounded-[1.5rem]">
            <div className="h-12 w-12 rounded-full bg-[#f0eee9] flex items-center justify-center font-bold text-[#404040] text-lg">
              {currentUser.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
              <p className="text-xs text-[#a3a3a3] font-medium capitalize truncate">{currentUser.role.toLowerCase()}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto no-scrollbar">
          {navigationItems.map(item => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id || (currentRoute === 'patientDetail' && item.id === 'patients') || (currentRoute === 'consultationWizard' && item.id === 'consultations');
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center px-4 py-3.5 text-sm font-bold rounded-full transition-all ${
                  isActive ? 'bg-[#eaf832] text-[#2b2b2b]' : 'text-[#a3a3a3] hover:bg-[#2b2b2b] hover:text-white'
                }`}
              >
                <Icon className={`mr-4 h-5 w-5 ${isActive ? 'text-[#2b2b2b]' : 'text-[#a3a3a3]'}`} />
                {item.label}
              </button>
            )
          })}
        </nav>
        
        <div className="p-6">
          <button 
            onClick={() => { logAudit('Cierre de Sesión', ''); setCurrentUser(null); }}
            className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold text-[#a3a3a3] bg-[#2b2b2b] hover:text-white hover:bg-red-500 rounded-full transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Salir
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden h-20 bg-[#fdfcfb] rounded-b-[2rem] shadow-sm flex items-center justify-between px-6 z-20 mx-2 mt-2">
           <div className="flex items-center">
            <Activity className="h-6 w-6 text-[#404040] mr-2" />
            <span className="text-xl font-extrabold text-[#2b2b2b]">Anamneo</span>
          </div>
          <button onClick={() => setCurrentUser(null)} className="text-[#666]"><LogOut className="h-6 w-6"/></button>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8 no-scrollbar">
          <div className="max-w-7xl mx-auto pb-10">
            {renderContent()}
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}