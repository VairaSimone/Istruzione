import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as scuoleService from '../services/scuoleService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectCanManage } from '../store/authStore';

/**
 * Hook delle IMPOSTAZIONI DELLA PROPRIA SCUOLA (insegnante/admin).
 *
 * A differenza di `useConfig` (pubblico, filtrato), qui arriva la vista
 * COMPLETA: comprende la sezione privata `didattica`, che contiene i vocabolari
 * con cui la scuola definisce le proprie classi, i propri livelli e le proprie
 * materie. Sono questi vocabolari — non più degli ENUM cablati nel codice — a
 * popolare i selettori dei form di aule, corsi, quiz e inviti.
 *
 * Vocabolario VUOTO ⇒ campo a testo libero. È la scelta di default per una
 * scuola nuova: nulla la costringe a usare la nomenclatura di un'altra.
 */

/** Impostazioni complete della propria scuola. `null` per l'admin (trasversale). */
export const useMieImpostazioni = () => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.scuole.mieImpostazioni,
    queryFn: scuoleService.getMieImpostazioni,
    enabled: canManage,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    // L'admin non ha una scuola propria: il backend risponde 403/404. Non ha
    // senso insistere.
    retry: false,
  });
};

/**
 * Vocabolario didattico della propria scuola.
 *
 * @param {'classiDisponibili'|'livelliDisponibili'|'materieDisponibili'} nome
 * @returns {string[]} elenco (eventualmente vuoto ⇒ testo libero)
 */
export const useVocabolario = (nome) => {
  const { data } = useMieImpostazioni();
  return useMemo(() => {
    const voci = data?.didattica?.[nome];
    return Array.isArray(voci) ? voci : [];
  }, [data, nome]);
};

/** Aggiornamento delle impostazioni della propria scuola (merge per sezione). */
export const useUpdateMieImpostazioni = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: scuoleService.updateMieImpostazioni,
    onSuccess: () => {
      // Il branding pubblico dipende dalle stesse impostazioni: va rifatto,
      // altrimenti l'utente salva i colori e continua a vedere i precedenti.
      queryClient.invalidateQueries({ queryKey: queryKeys.scuole.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
    },
  });
};
