import { describe, expect, it } from 'vitest';
import { readTable } from '@/lib/table';
import { DEFAULT_MAPPING, parseSalesCsv, priceCents } from './csv';

const read = (text: string) => readTable(Buffer.from(text, 'utf8'), 'ventes.csv');
const HEAD = 'Ticket;Date;Heure;Code barre;Référence;Désignation;Quantité;Prix unitaire TTC';

describe('parseSalesCsv', () => {
  it('semicolons, decimal comma, BOM, quoted fields, a date with its time column', async () => {
    const { rows, errors } = parseSalesCsv(await read(`﻿${HEAD}\r\n1001;17/11/2026;14:05;5601234000016;;"Douro; Reserva";2;"13,50"\r\n1001;17/11/2026;14:05;;GG-ALT;Alentejo;1;9,90\r\n`));
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 2, receipt: '1001', date: '2026-11-17', time: '14:05', barcode: '5601234000016', ref: null, qty: 2, unitPriceCents: 1350 },
      { line: 3, receipt: '1001', date: '2026-11-17', time: '14:05', barcode: null, ref: 'GG-ALT', qty: 1, unitPriceCents: 990 },
    ]);
  });

  it('comma-separated, ISO date with the time in it; an unquoted "13,50" is refused, never read as 13', async () => {
    const text = 'Ticket,Date,Code barre,Quantité,Prix unitaire TTC\n7,2026-11-17 09:30,123,1,4.50\n8,2026-11-17 09:31,124,1,13,50\n';
    const { rows, errors } = parseSalesCsv(await read(text), { ...DEFAULT_MAPPING, time: '', ref: '' });
    expect(rows).toEqual([{ line: 2, receipt: '7', date: '2026-11-17', time: '09:30', barcode: '123', ref: null, qty: 1, unitPriceCents: 450 }]);
    expect(errors).toEqual([{ line: 3, reason: 'columns' }]);
  });

  it('each unreadable row says why; blank rows are skipped', async () => {
    const text = [HEAD, ';17/11/2026;10:00;1;;x;1;1,00', '2;31/02/2026;10:00;1;;x;1;1,00', '3;17/11/2026;10:00;1;;x;0;1,00', '4;17/11/2026;10:00;1;;x;1,5;1,00', '5;17/11/2026;10:00;1;;x;1;abc', '6;17/11/2026;10:00;;;x;1;1,00', ';;;;;;;'].join('\n');
    const { rows, errors } = parseSalesCsv(await read(text));
    expect(rows).toEqual([]);
    expect(errors.map((e) => [e.line, e.reason])).toEqual([
      [2, 'receipt'],
      [3, 'date'],
      [4, 'qty'],
      [5, 'qty'],
      [6, 'price'],
      [7, 'code'],
    ]);
  });

  it('columns named differently in Settings are found, loosely; a missing one is reported', async () => {
    const text = 'receipt_no|day|ean|qty|price\n'.replaceAll('|', ';') + '9;17.11.2026;77;3;2,00\n';
    const mapping = { receipt: 'Receipt no', date: 'Day', time: '', barcode: 'EAN', ref: '', qty: 'QTY', unitPrice: 'Price' };
    expect(parseSalesCsv(await read(text), mapping).rows).toEqual([{ line: 2, receipt: '9', date: '2026-11-17', time: '12:00', barcode: '77', ref: null, qty: 3, unitPriceCents: 200 }]);
    expect(parseSalesCsv(await read(text)).missing).toEqual(['Ticket', 'Date', 'Quantité', 'Prix unitaire TTC', 'Code barre / Référence']);
  });

  it('prices: thousands separators either way, euro sign, half-cent rounding', () => {
    expect([priceCents('1 234,50'), priceCents('1.234,50'), priceCents('1,234.50'), priceCents('€ 13,5'), priceCents('0,005'), priceCents('-1,00')]).toEqual([123450, 123450, 123450, 1350, 1, -100]);
  });
});
