'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { FiArrowLeft, FiSave } from 'react-icons/fi';

export default function NuevaAfeccionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthStore();

  const [name, setName] = useState('');
  const [synonyms, setSynonyms] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (!isAdmin()) {
      router.push('/catalogo');
    }
  }, [isAdmin, router]);

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
      };
      const response = await api.post('/conditions', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Afección creada');
      queryClient.invalidateQueries({ queryKey: ['conditions'] });
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
          <h1 className="text-2xl font-bold text-slate-900">Nueva afección</h1>
          <p className="text-slate-600">Disponible para sugerencias automáticas</p>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="text-sm text-slate-600">Nombre</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-600">Sinónimos (separados por coma)</label>
          <input
            className="form-input"
            value={synonyms}
            onChange={(e) => setSynonyms(e.target.value)}
            placeholder="cefalea, jaqueca, ..."
          />
        </div>
        <div>
          <label className="text-sm text-slate-600">Tags (separados por coma)</label>
          <input
            className="form-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="neurológico, dolor, ..."
          />
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
      </div>
    </div>
  );
}
