import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, PackageCheck } from 'lucide-react';
import type { Shipment } from '../types/ppjk';
import {
  computeDashboardStats,
  isUrgentMissingAju,
} from '../utils/ppjkLogic';
import { CountdownBadge, JalurBadge, StatusBadge } from './Badges';

Chart.register(...registerables);

interface DashboardViewProps {
  shipments: Shipment[];
  checklistItems: string[];
  onOpenDetail: (kodeOs: string) => void;
  onGoToOutstanding: () => void;
}

export function DashboardView({
  shipments,
  checklistItems,
  onOpenDetail,
  onGoToOutstanding,
}: DashboardViewProps) {
  const stats = computeDashboardStats(shipments, checklistItems);
  const monthCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const customerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const jalurCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const instances: Chart[] = [];

    if (monthCanvasRef.current) {
      instances.push(
        new Chart(monthCanvasRef.current, {
          type: 'bar',
          data: {
            labels: stats.byMonth.length > 0 ? stats.byMonth.map((m) => m.month) : ['Belum Ada'],
            datasets: [
              {
                label: 'Shipment',
                data: stats.byMonth.length > 0 ? stats.byMonth.map((m) => m.count) : [0],
                backgroundColor: '#0B2545',
                borderRadius: 6,
                maxBarThickness: 44,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
          },
        })
      );
    }

    if (customerCanvasRef.current) {
      instances.push(
        new Chart(customerCanvasRef.current, {
          type: 'bar',
          data: {
            labels:
              stats.byCustomer.length > 0
                ? stats.byCustomer.map((c) => c.customer.slice(0, 18))
                : ['Belum Ada'],
            datasets: [
              {
                label: 'Shipment',
                data: stats.byCustomer.length > 0 ? stats.byCustomer.map((c) => c.count) : [0],
                backgroundColor: '#F28C28',
                borderRadius: 6,
                maxBarThickness: 28,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
          },
        })
      );
    }

    if (jalurCanvasRef.current) {
      const labels = ['Hijau', 'Kuning', 'Merah', 'MITA', 'Belum Ada'];
      instances.push(
        new Chart(jalurCanvasRef.current, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [
              {
                data: labels.map((l) => stats.byJalur[l] || 0),
                backgroundColor: ['#2E9E5B', '#F2C037', '#D64545', '#3B82F6', '#CBD5E1'],
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 12, font: { size: 11 } },
              },
            },
          },
        })
      );
    }

    return () => {
      instances.forEach((c) => c.destroy());
    };
  }, [shipments, stats.byMonth, stats.byCustomer, stats.byJalur]);

  const urgentShipments = shipments.filter(
    (s) =>
      isUrgentMissingAju(s) ||
      ((s.jalur === 'Merah' || s.jalur === 'MITA') && s.status !== 'Selesai')
  );

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Shipment</span>
            <PackageCheck className="w-4 h-4 text-[#0B2545]" />
          </div>
          <div className="text-3xl font-bold text-[#0B2545] mt-2 tabular-nums">
            {stats.total}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Seluruh dokumen impor tercatat
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Dokumen Outstanding</span>
            <AlertCircle className="w-4 h-4 text-[#F28C28]" />
          </div>
          <div className="text-3xl font-bold text-[#0B2545] mt-2 tabular-nums">
            {stats.outstanding}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Belum SPPB atau Dokumen OS belum lengkap
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>ETA 7 Hari ke Depan</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-[#0B2545] mt-2 tabular-nums">
            {stats.etaNext7Days}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Kapal tiba dalam 0–7 hari
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>ETA &lt; 3 Hari Tanpa AJU</span>
            <AlertCircle className="w-4 h-4 text-[#D64545]" />
          </div>
          <div className="text-3xl font-bold text-[#D64545] mt-2 tabular-nums">
            {stats.urgentMissingAju}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Butuh pengajuan PIB/AJU segera
          </div>
        </div>
      </div>

      {/* Ringkasan Status & Jalur */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-[#0B2545] mb-3">
          Distribusi Status Shipment
        </h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.byStatus).length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada data status.</p>
          ) : (
            Object.entries(stats.byStatus).map(([status, count]) => (
              <div
                key={status}
                className="min-w-[140px] flex-1 p-3 rounded-lg bg-slate-50 border border-slate-200/80"
              >
                <div className="text-xs text-slate-600 whitespace-nowrap">
                  {status}
                </div>
                <div className="text-xl font-bold text-[#0B2545] mt-1 tabular-nums">
                  {count}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chart.js Visualisasi */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-[#0B2545]">Shipment per Bulan</h3>
          <div className="h-56 mt-3">
            <canvas ref={monthCanvasRef} data-testid="chart-month" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-[#0B2545]">Shipment per Customer</h3>
          <div className="h-56 mt-3">
            <canvas ref={customerCanvasRef} data-testid="chart-customer" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-[#0B2545]">Distribusi Jalur</h3>
          <div className="h-56 mt-3">
            <canvas ref={jalurCanvasRef} data-testid="chart-jalur" />
          </div>
        </div>
      </div>

      {/* Prioritas & Peringatan */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#0B2545]">
              Perhatian Prioritas (ETA &lt; 3 Hari Tanpa AJU &amp; Jalur Merah/MITA)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik baris untuk membuka panel detail 39 kolom.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToOutstanding}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-[#0B2545] bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <span>Lihat Semua Outstanding</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {urgentShipments.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Tidak ada shipment mendesak yang memerlukan tindakan saat ini.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {urgentShipments.map((s) => (
              <button
                key={s.kodeOs}
                type="button"
                onClick={() => onOpenDetail(s.kodeOs)}
                className="w-full py-3 px-2 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono-code text-xs font-semibold text-[#0B2545]">
                      {s.kodeOs}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {s.namaCustomer}
                    </span>
                    {isUrgentMissingAju(s) && (
                      <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                        Belum Ada No. AJU
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    BL: {s.noBl} · ETA: {s.eta || '-'} · {s.ship || 'Kapal belum diisi'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CountdownBadge days={s.countDownEta} />
                  <StatusBadge status={s.status} />
                  <JalurBadge jalur={s.jalur} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
