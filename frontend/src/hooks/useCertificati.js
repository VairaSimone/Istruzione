import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as certificatiService from '../services/certificatiService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectIsAuthenticated, selectCanManage } from '../store/authStore';

/**
 * Hook del modulo CERTIFICAZIONI.
 *
 * L'ELENCO e il DETTAGLIO sono accessibili a chiunque sia autenticato: lo
 * studente riceve i propri certificati, lo staff quelli della scuola (il
 * backend applica lo scope per ruolo). Il RILASCIO/REVOCA e l'upload delle
 * risorse (logo/firma) sono riservati a chi può gestire (insegnante/admin). La
 * VERIFICA pubblica non richiede autenticazione.
 */

// ── Letture (studente + staff) ──

export const useCertificatiList = (filters = {}) => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return useQuery({
    queryKey: queryKeys.certificati.list(filters),
    queryFn: () => certificatiService.getCertificati(filters),
    enabled: isAuthenticated,
    placeholderData: (previousData) => previousData,
  });
};

export const useCertificato = (id) => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return useQuery({
    queryKey: queryKeys.certificati.detail(id),
    queryFn: () => certificatiService.getCertificatoById(id),
    enabled: isAuthenticated && Boolean(id),
  });
};

// ── Verifica pubblica (nessuna autenticazione richiesta) ──

export const useVerificaCertificato = (codice) =>
  useQuery({
    queryKey: queryKeys.certificati.verifica(codice),
    queryFn: () => certificatiService.verificaCertificato(codice),
    enabled: Boolean(codice),
    retry: false,
  });

// ── Mutazioni (insegnante/admin) ──

const useInvalidateCertificati = () => {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.certificati.all });
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificati.detail(id) });
    }
  };
};

export const useEmettiCertificato = () => {
  const canManage = useAuthStore(selectCanManage);
  const invalidate = useInvalidateCertificati();
  return useMutation({
    mutationFn: certificatiService.emettiCertificato,
    onSuccess: () => invalidate(),
    meta: { canManage },
  });
};

export const useRevocaCertificato = () => {
  const invalidate = useInvalidateCertificati();
  return useMutation({
    mutationFn: certificatiService.revocaCertificato,
    onSuccess: (_d, variables) => invalidate(variables.id),
  });
};

export const useUploadRisorsaCertificato = () =>
  useMutation({
    mutationFn: certificatiService.uploadRisorsa,
  });
