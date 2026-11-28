/**
 * Registro de auditoría.
 *
 * Solo estado y manejadores: los efectos que cargan datos siguen en
 * SuperadminPanel, en su orden original, para no cambiar cuándo se piden.
 */
import { useState } from 'react';
import { type AuditLog } from './tipos';
import { tokenSesion } from './sesion';
import { apiUrl } from '../../lib/api';

export const useAuditoriaAdmin = () => {
  // --- Auditoría State ---
  const [logsAuditoria, setLogsAuditoria] = useState<AuditLog[]>([]);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);

  // 2. Cargar Auditoría
  const fetchAuditoria = async () => {
    setLoadingAuditoria(true);
    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/auditoria-logs'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogsAuditoria(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAuditoria(false);
    }
  };

  return {
    logsAuditoria,
    setLogsAuditoria,
    loadingAuditoria,
    setLoadingAuditoria,
    fetchAuditoria,
  };
};

export type AuditoriaAdmin = ReturnType<typeof useAuditoriaAdmin>;
