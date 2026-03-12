'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Condition } from '@/types';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import { parseJsonArray } from '@/lib/safe-json';

export default function EditarAfeccionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthStore();

  const { data: condition, isLoading } = useQuery({
    queryKey: ['condition', id],
    queryFn: async () => {
      const response = await api.get(`/conditions/${id}`);
      return response.data as Condition;
    },
    enabled: isAdmin(),
  });

  const initialSynonyms = useMemo(() => {
    if (!condition) return '';
    return parseJsonArray(condition.synonyms).join(', ');
  }, [condition]);

  const initialTags = useMemo(() => {
    if (!condition) return '';
    return parseJsonArray(condition.tags).join(', ');
  }, [condition]);

  const [name, setName] = useState('');
  const [synonyms, setSynonyms] = useState('');
  const [tags, setTags] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!isAdmin()) {
      router.push('/catalogo');
      return;
    }

    if (condition) {
      setName(condition.name);
      setSynonyms(initialSynonyms);
      setTags(initialTags);
      setActive(condition.active);
    }
  }, [isAdmin, router, condition, initialSynonyms, initialTags]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        synonyms: synonyms
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        active,
      };
      const response = await api.put(`/conditions/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Afección actualizada');
      queryClient.invalidateQueries({ queryKey: ['conditions'] });
      queryClient.invalidateQueries({ queryKey: ['condition', id] });
      router.push('/catalogo');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (!isAdmin()) return null;

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/catalogo" className="p-2 hover:bg-slate-100 rounded-lg">
          <FiArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editar afección</h1>
          <p className="text-slate-600">Actualizar nombre, sinónimos, tags y estado</p>
        </div>
      </div>

      <div className="card space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-10 skeleton rounded" />
            <div className="h-10 skeleton rounded" />
            <div className="h-10 skeleton rounded" />
          </div>
        ) : (
          <>
            <div>
              <label className="text-sm text-slate-600">Nombre</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-600">Sinónimos (separados por coma)</label>
              <input className="form-input" value={synonyms} onChange={(e) => setSynonyms(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-600">Tags (separados por coma)</label>
              <input className="form-input" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Activa
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                className="btn btn-primary flex items-center gap-2"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                <FiSave className="w-4 h-4" />
                Guardar
              </button>
              <Link href="/catalogo" className="btn btn-secondary">
                Cancelar
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
