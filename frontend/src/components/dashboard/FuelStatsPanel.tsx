import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Fuel } from "lucide-react";

interface FuelStatsPanelProps {
  fuelChartData: any[];
  projectData: any[];
  fuelEquipmentReport: any[];
}

const FuelStatsPanel: React.FC<FuelStatsPanelProps> = ({ fuelChartData, projectData, fuelEquipmentReport }) => {
  return (
    <>
      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Fuel chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-800">
              Penggunaan BBM per Alat (30 hari)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Total liter BBM yang diisi per unit
            </p>
          </div>
          {fuelChartData.length === 0 ? (
            <p className="text-gray-400 text-sm py-10 text-center">
              Belum ada data BBM dalam 30 hari terakhir.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={fuelChartData}
                margin={{ top: 8, right: 8, bottom: 40, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  angle={-28}
                  textAnchor="end"
                  height={60}
                  interval={0}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => [`${Number(v).toFixed(1)} L`, "Total BBM"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullName || ""
                  }
                />
                <Bar
                  dataKey="liters"
                  name="Liter"
                  fill="#d97706"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Project status pie */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-800">
              Status Proyek
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Distribusi status proyek aktif
            </p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={projectData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {projectData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── BBM Table ─────────────────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <Fuel className="h-5 w-5 text-amber-600" />
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Ringkasan BBM (30 hari)
            </h2>
            <p className="text-xs text-gray-400">
              Per unit yang punya pengisian BBM
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 font-medium text-gray-600 text-xs uppercase whitespace-nowrap">
                  Alat
                </th>
                <th className="px-4 py-2 font-medium text-gray-600 text-xs uppercase whitespace-nowrap">
                  Tipe
                </th>
                <th className="px-4 py-2 font-medium text-gray-600 text-xs uppercase text-right whitespace-nowrap">
                  Total BBM (L)
                </th>
                <th className="px-4 py-2 font-medium text-gray-600 text-xs uppercase text-right whitespace-nowrap">
                  Kali Isi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fuelEquipmentReport.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    Belum ada aktivitas BBM dalam periode ini.
                  </td>
                </tr>
              ) : (
                fuelEquipmentReport.map((row) => (
                  <tr
                    key={row.equipment_id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">
                      {row.equipment_name}
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {row.equipment_type}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-amber-700 tabular-nums whitespace-nowrap">
                      {row.total_liters.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600 tabular-nums whitespace-nowrap">
                      {row.refuel_count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default FuelStatsPanel;
