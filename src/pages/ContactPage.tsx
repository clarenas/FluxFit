import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const QUERY_TYPES = [
  'Soporte técnico',
  'Consulta comercial',
  'Quiero registrar mi gym',
  'Quiero registrar mi comercio',
  'Otro',
];

export function ContactPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [type, setType] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-[#111111] focus:outline-none focus:border-[#CC0000] transition-colors';
  const labelClass = 'text-sm text-[#666666] mb-1 block';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from('contact_messages').insert({
        name,
        email,
        type,
        message,
        user_id: user?.id ?? null,
      });
      if (insertError) throw insertError;
      setSuccess(true);
    } catch {
      setError('No se pudo enviar el mensaje. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#16A34A]/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-[#16A34A]" />
        </div>
        <h2 className="text-xl font-bold text-[#111111] mb-2">¡Mensaje enviado!</h2>
        <p className="text-sm text-[#666666] leading-relaxed">
          Te responderemos en menos de 48 horas a{' '}
          <span className="font-semibold text-[#111111]">{email}</span>.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 w-full max-w-xs py-3.5 bg-[#CC0000] text-white font-bold rounded-xl text-base active:scale-[0.98] transition-transform"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="bg-white border-b border-[#E5E5E5] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center -ml-1">
          <ArrowLeft size={22} className="text-[#111111]" />
        </button>
        <h1 className="text-[#111111] font-bold text-lg">Contáctanos</h1>
      </div>

      <div className="px-4 pt-6 pb-12">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nombre completo</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputClass}
              placeholder="Tu nombre"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputClass}
              placeholder="tu@email.com"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Tipo de consulta</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className={inputClass}
              required
            >
              <option value="" disabled>Selecciona una opción</option>
              {QUERY_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Mensaje</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              className={inputClass + ' resize-none'}
              placeholder="Contanos en qué podemos ayudarte..."
              required
              minLength={20}
              rows={4}
            />
          </div>
          {error && <p className="text-[#CC0000] text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-[#CC0000] text-white font-bold rounded-xl text-base active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar mensaje'}
          </button>
        </form>
      </div>
    </div>
  );
}

/*
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false
);
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert contact messages"
  ON contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "FluxFit admin can read messages"
  ON contact_messages FOR SELECT TO authenticated USING (true);
*/
