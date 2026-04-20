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
      router.push('/catalogo?categoria=afecciones');
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
      router.push('/catalogo?categoria=afecciones');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (!isAdmin()) return null;

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/catalogo?categoria=afecciones" className="p-2 hover:bg-surface-muted rounded-lg">
          <FiArrowLeft className="w-5 h-5 text-ink-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">Editar afección</h1>
          <p className="text-ink-secondary">Actualizar nombre, sinónimos, tags y estado</p>
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
              <label className="text-sm text-ink-secondary">Nombre</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-ink-secondary">Sinónimos (separados por coma)</label>
              <input className="form-input" value={synonyms} onChange={(e) => setSynonyms(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-ink-secondary">Tags (separados por coma)</label>
              <input className="form-input" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <div>
              <label className="inline-flex items-center gap-2 text-sm text-ink-secondary">
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
              <Link href="/catalogo?categoria=afecciones" className="btn btn-secondary">
                Cancelar
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
