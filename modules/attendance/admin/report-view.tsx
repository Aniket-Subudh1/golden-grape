import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps } from 'payload';
import { hasRole } from '@/lib/access';
import { hoursAndMinutes, today } from '@/lib/time';
import { langOf } from '@/modules/sales/admin/text';
import { isModuleOn } from '@/modules/settings/service';
import { monthlyReport, whoIsIn } from '../service';
import { ExportButton } from './correct-button';

// The monthly attendance report (/admin/attendance-report, M3.3 T3): who is in now, then hours per person per day and
// the month's total, the same `monthlyReport` as the staff screen and the CSV. Managers only.

const TEXT = {
  fr: { title: 'Heures du mois', subtitle: 'Heures pointées par personne et par jour. Un départ manquant compte 0 jusqu’à sa correction (ouvrez le pointage, « Corriger »).', now: 'Pointés maintenant', nobody: 'Personne n’est pointé.', since: 'depuis', person: 'Personne', total: 'Total', missing: 'départ manquant', none: 'Aucun pointage ce mois-ci.', prev: '← Mois précédent', next: 'Mois suivant →', forbidden: 'Votre rôle ne permet pas de voir cette page.', off: 'Le module Pointage est éteint (Infos de la boutique › Modules et alertes).', shifts: 'Voir les pointages' },
  en: { title: 'Monthly hours', subtitle: 'Hours clocked per person and day. A missing check-out counts 0 until corrected (open the shift, “Correct”).', now: 'Checked in now', nobody: 'Nobody is checked in.', since: 'since', person: 'Person', total: 'Total', missing: 'check-out missing', none: 'No shifts this month.', prev: '← Previous month', next: 'Next month →', forbidden: 'Your role cannot see this page.', off: 'The Time clock module is switched off (Shop details › Modules and alerts).', shifts: 'See the shifts' },
  de: { title: 'Monatsstunden', subtitle: 'Erfasste Stunden pro Person und Tag. Ein fehlendes Gehen zählt 0 bis zur Korrektur (Schicht öffnen, „Korrigieren“).', now: 'Jetzt eingestempelt', nobody: 'Niemand ist eingestempelt.', since: 'seit', person: 'Person', total: 'Summe', missing: 'Gehen fehlt', none: 'Keine Schichten in diesem Monat.', prev: '← Voriger Monat', next: 'Nächster Monat →', forbidden: 'Ihre Rolle darf diese Seite nicht sehen.', off: 'Das Modul Zeiterfassung ist ausgeschaltet (Geschäftsdaten › Module und Warnungen).', shifts: 'Schichten ansehen' },
  pt: { title: 'Horas do mês', subtitle: 'Horas registadas por pessoa e por dia. Uma saída em falta conta 0 até ser corrigida (abra o turno, «Corrigir»).', now: 'Com entrada agora', nobody: 'Ninguém tem entrada registada.', since: 'desde', person: 'Pessoa', total: 'Total', missing: 'saída em falta', none: 'Sem turnos este mês.', prev: '← Mês anterior', next: 'Mês seguinte →', forbidden: 'A sua função não permite ver esta página.', off: 'O módulo Ponto está desligado (Dados da loja › Módulos e alertas).', shifts: 'Ver os turnos' },
};

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export default async function AttendanceReportView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = initPageResult;
  if (req.user?.collection !== 'users') redirect('/admin/login?redirect=%2Fadmin%2Fattendance-report');
  const lang = langOf(req.i18n.language);
  const t = TEXT[lang];
  const allowed = hasRole(req.user, ['manager']);
  const on = await isModuleOn('attendance');
  const asked = typeof searchParams?.month === 'string' ? searchParams.month : '';
  const month = /^\d{4}-\d{2}$/.test(asked) ? asked : today().slice(0, 7);
  const [inNow, report] = allowed && on ? await Promise.all([whoIsIn(req.payload), monthlyReport(req.payload, month)]) : [[], null];
  const clock = new Intl.DateTimeFormat(lang, { timeStyle: 'short', timeZone: 'Europe/Luxembourg' });
  const monthName = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`));
  const dayNum = (day: string) => Number(day.slice(8));

  return (
    <DefaultTemplate i18n={req.i18n} locale={locale} params={params} payload={req.payload} permissions={permissions} searchParams={searchParams} user={req.user} visibleEntities={visibleEntities}>
      <Gutter>
        <div className="gg-home">
          <div className="gg-home__title">
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
          {!allowed ? (
            <p className="gg-card__empty">{t.forbidden}</p>
          ) : !on || !report ? (
            <p className="gg-card__empty">{t.off}</p>
          ) : (
            <>
              <section className="gg-card">
                <header className="gg-card__head">
                  <div>
                    <h2>{t.now}</h2>
                  </div>
                </header>
                {inNow.length === 0 ? (
                  <p className="gg-card__empty">{t.nobody}</p>
                ) : (
                  <div className="gg-reorder">
                    <div className="table">
                      <table>
                        <tbody>
                          {inNow.map((s) => (
                            <tr key={s.id}>
                              <td>
                                <a href={`/admin/collections/attendance/${s.id}`}>{typeof s.user === 'object' ? s.user.name : ''}</a>
                              </td>
                              <td>
                                {t.since} {clock.format(new Date(s.checkIn!))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
              <section className="gg-card">
                <header className="gg-card__head">
                  <div>
                    <h2 style={{ textTransform: 'capitalize' }}>{monthName}</h2>
                    <p>
                      <a href={`/admin/attendance-report?month=${shiftMonth(month, -1)}`}>{t.prev}</a>
                      {' · '}
                      <a href={`/admin/attendance-report?month=${shiftMonth(month, 1)}`}>{t.next}</a>
                      {' · '}
                      <a href={`/admin/collections/attendance?where[day][like]=${month}`}>{t.shifts}</a>
                    </p>
                  </div>
                  {report.people.length > 0 && <ExportButton month={month} />}
                </header>
                {report.people.length === 0 ? (
                  <p className="gg-card__empty">{t.none}</p>
                ) : (
                  <div className="gg-reorder">
                    <div className="table">
                      <table>
                        <thead>
                          <tr>
                            <th>{t.person}</th>
                            {report.days.map((d) => (
                              <th key={d}>{dayNum(d)}</th>
                            ))}
                            <th>{t.total}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.people.map((p) => (
                            <tr key={p.id}>
                              <td>
                                {p.name}
                                {p.openShifts > 0 && (
                                  <>
                                    <br />
                                    <small style={{ color: '#b45309' }}>
                                      {p.openShifts} × {t.missing}
                                    </small>
                                  </>
                                )}
                              </td>
                              {report.days.map((d) => (
                                <td key={d} style={p.days[d]?.open ? { color: '#b45309', fontWeight: 600 } : undefined}>
                                  {p.days[d] ? (p.days[d].open && !p.days[d].minutes ? '?' : (p.days[d].minutes / 60).toFixed(1)) : ''}
                                </td>
                              ))}
                              <td>
                                <b>{hoursAndMinutes(p.totalMinutes)}</b>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </Gutter>
    </DefaultTemplate>
  );
}
