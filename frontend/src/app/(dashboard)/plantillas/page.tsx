'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiFileText } from 'react-icons/fi';

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  sectionKey: string | null;
  createdAt: string;
}

const CATEGORIES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'SOAP', label: 'SOAP' },
  { value: 'CONTROL_CRONICO', label: 'Control crónico' },
  { value: 'DERIVACION', label: 'Derivación' },
  { value: 'RECETA', label: 'Receta' },
];

const SECTION_KEYS = [
  { value: '', label: 'Todas las secciones' },
  { value: 'MOTIVO_CONSULTA', label: 'Motivo de consulta' },
  { value: 'ANAMNESIS_PROXIMA', label: 'Anamnesis próxima' },
  { value: 'TRATAMIENTO', label: 'Tratamiento' },
  { value: 'RESPUESTA_TRATAMIENTO', label: 'Respuesta al tratamiento' },
  { value: 'OBSERVACIONES', label: 'Observaciones' },
];

export default function PlantillasPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', category: 'GENERAL', content: '', sectionKey: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => (await api.get('/templates')).data,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, sectionKey: form.sectionKey || undefined };
      if (editingId) {
        return api.put(`/templates/${editingId}`, payload);
      }
      return api.post('/templates', payload);
    },
    onSuccess: () => {
      toast.success(editingId ? 'Plantilla actualizada' : 'Plantilla creada');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => {
      toast.success('Plantilla eliminada');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resetForm = () => {
    setForm({ name: '', category: 'GENERAL', content: '', sectionKey: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (t: Template) => {
    setForm({ name: t.name, category: t.category, content: t.content, sectionKey: t.sectionKey || '' });
    setEditingId(t.id);
    setShowForm(true);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plantillas de texto</h1>
          <p className="text-slate-600">Crea plantillas reutilizables para tus atenciones</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" onClick={() => { resetForm(); setShowForm(true); }}>
          <FiPlus className="w-4 h-4" />
          Nueva plantilla
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 border-primary-200">
          <h2 className="font-semibold text-slate-900 mb-4">
            {editingId ? 'Editar plantilla' : 'Nueva plantilla'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Nombre</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: SOAP estándar"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Categoría</label>
              <select
                className="form-input"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Sección (opcional)</label>
              <select
                className="form-input"
                value={form.sectionKey}
                onChange={(e) => setForm((p) => ({ ...p, sectionKey: e.target.value }))}
              >
                {SECTION_KEYS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-slate-600 mb-1">Contenido</label>
            <textarea
              className="form-input min-h-[120px]"
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              placeholder="Escribe el contenido de la plantilla..."
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary"
              onClick={() => saveMutation.mutate()}
              disabled={!form.name.trim() || !form.content.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button className="btn btn-secondary" onClick={resetForm}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 skeleton rounded-lg" />)}
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {templates.map((t) => (
              <div key={t.id} className="flex items-start gap-4 p-4 group">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FiFileText className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-slate-900">{t.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {CATEGORIES.find((c) => c.value === t.category)?.label || t.category}
                    </span>
                    {t.sectionKey && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">
                        {SECTION_KEYS.find((s) => s.value === t.sectionKey)?.label || t.sectionKey}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2">{t.content}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    onClick={() => startEdit(t)}
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    onClick={() => { if (confirm('¿Eliminar esta plantilla?')) deleteMutation.mutate(t.id); }}
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <FiFileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">No tienes plantillas todavía</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <FiPlus className="w-4 h-4 mr-2" />
              Crear primera plantilla
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
