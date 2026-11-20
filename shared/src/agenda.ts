// Agenda do caso: de "toda sexta às 21h" para a data da próxima sessão.
import type { Agenda } from './schemas/campanha.ts';

/**
 * A próxima vez, a partir de `agora`, que cai no dia e no horário da agenda, no fuso de quem
 * chama (o navegador do mestre). Se hoje é o dia e o horário ainda não passou, é hoje.
 */
export function proximaSessaoDa(agenda: Pick<Agenda, 'diaDaSemana' | 'horario'>, agora: Date) {
  const [hora = 0, minuto = 0] = agenda.horario.split(':').map(Number);
  const data = new Date(agora);
  data.setHours(hora, minuto, 0, 0);
  let dias = (agenda.diaDaSemana - agora.getDay() + 7) % 7;
  if (dias === 0 && data.getTime() <= agora.getTime()) dias = 7;
  data.setDate(data.getDate() + dias);
  return data;
}
