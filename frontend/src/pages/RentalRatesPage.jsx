import React, { useState, useEffect } from 'react';
import { Truck, DollarSign, Save, Filter, Download, AlertCircle, Building2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Rental Rates Management - Bina-ERP Finance Module
 * 
 * Fitur:
 * - Kelola tarif sewa per equipment
 * - Kelola nilai deposit
 * - Status ownership (Internal vs Rental)
 * - Kalkulasi total biaya rental
 */

const RentalRatesPage = () => {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [filter, setFilter] = useState('all'); // all, internal, rental
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    fetchCurrentUser();
    fetchEquipment();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchEquipment = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/equipment', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEquipment(data);
      }
    } catch (error) {
      console.error('Error fetching equipment:', error);
      toast.error('Gagal memuat data equipment');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditData({
      rental_rate_per_hour: item.rental_rate_per_hour || '',
      deposit_amount: item.deposit_amount || '',
      ownership_status: item.ownership_status || 'internal',
      vendor_id: item.vendor_id || ''
    });
  };

  const handleSave = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/equipment/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rental_rate_per_hour: editData.rental_rate_per_hour === '' ? null : parseFloat(editData.rental_rate_per_hour),
          deposit_amount: editData.deposit_amount === '' ? null : parseFloat(editData.deposit_amount),
          ownership_status: editData.ownership_status,
          vendor_id: editData.vendor_id === '' ? null : editData.vendor_id
        })
      });

      if (response.ok) {
        fetchEquipment();
        setEditingId(null);
        setEditData({});
        toast.success('Data rental berhasil diupdate');
      } else {
        toast.error('Gagal mengupdate data rental');
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Terjadi kesalahan saat menyimpan');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const filteredEquipment = equipment.filter(item => {
    if (filter === 'all') return true;
    return item.ownership_status === filter;
  });

  // Calculate totals
  const totalDeposit = equipment
    .filter(e => e.ownership_status === 'rental')
    .reduce((sum, e) => sum + (parseFloat(e.deposit_amount) || 0), 0);
  
  const totalRentalRate = equipment
    .filter(e => e.ownership_status === 'rental')
    .reduce((sum, e) => sum + (parseFloat(e.rental_rate_per_hour) || 0), 0);

  // Check finance access
  const hasFinanceAccess = currentUser?.role === 'gm' || currentUser?.role === 'finance';

  if (!hasFinanceAccess && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle size={64} className="text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
        <p className="text-gray-600">Halaman ini hanya untuk GM dan Finance Staff.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center">
          <Truck className="h-6 w-6 sm:h-8 sm:w-8 mr-3 text-blue-500 flex-shrink-0" />
          Tarif Sewa &amp; Deposit
        </h1>
        <p className="text-gray-600 mt-2">Kelola harga rental per jam dan nilai deposit equipment</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6 min-w-0 fluid-metric-container">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="p-3 bg-blue-100 rounded-lg flex-shrink-0">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 fluid-metric-value text-right">
              {equipment.filter(e => e.ownership_status === 'rental').length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Equipment Rental</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 min-w-0 fluid-metric-container">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="p-3 bg-green-100 rounded-lg flex-shrink-0">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 fluid-metric-value text-right">
              Rp {totalRentalRate.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Total Tarif/Jam</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 min-w-0 fluid-metric-container">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="p-3 bg-amber-100 rounded-lg flex-shrink-0">
              <Wallet className="h-6 w-6 text-amber-600" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 fluid-metric-value text-right">
              Rp {totalDeposit.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Total Deposit Ditahan</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Equipment</option>
              <option value="internal">Milik Sendiri</option>
              <option value="rental">Sewa/Rental</option>
            </select>
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Download className="h-4 w-4" />
            <span>Export Data</span>
          </button>
        </div>
      </div>

      {/* Equipment Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50 whitespace-nowrap">
            <tr>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Nama Equipment</th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Status Kepemilikan</th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Tarif/Jam (Rp)</th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Deposit (Rp)</th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEquipment.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.type}</p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === item.id ? (
                    <select
                      value={editData.ownership_status}
                      onChange={(e) => setEditData({ ...editData, ownership_status: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="internal">Milik Sendiri</option>
                      <option value="rental">Sewa/Rental</option>
                    </select>
                  ) : (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.ownership_status === 'rental' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.ownership_status === 'rental' ? 'Sewa' : 'Milik Sendiri'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === item.id ? (
                    <input
                      type="number"
                      value={editData.rental_rate_per_hour}
                      onChange={(e) => setEditData({ ...editData, rental_rate_per_hour: e.target.value })}
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="0"
                    />
                  ) : (
                    <p className="text-sm text-gray-900">
                      {item.rental_rate_per_hour 
                        ? `Rp ${parseFloat(item.rental_rate_per_hour).toLocaleString('id-ID')}` 
                        : '-'}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === item.id ? (
                    <input
                      type="number"
                      value={editData.deposit_amount}
                      onChange={(e) => setEditData({ ...editData, deposit_amount: e.target.value })}
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="0"
                    />
                  ) : (
                    <p className="text-sm text-gray-900">
                      {item.deposit_amount 
                        ? `Rp ${parseFloat(item.deposit_amount).toLocaleString('id-ID')}` 
                        : '-'}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === item.id ? (
                    <div className="flex items-center space-x-1">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={editData.vendor_id}
                        onChange={(e) => setEditData({ ...editData, vendor_id: e.target.value })}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Vendor ID"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {item.vendor_id || '-'}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === item.id ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSave(item.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        Simpan
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filteredEquipment.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Tidak ada equipment yang sesuai filter
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">Informasi Penting:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Perubahan tarif sewa akan berlaku untuk perhitungan di periode berikutnya</li>
          <li>• Deposit ditahan sebagai jaminan dan akan dikembalikan setelah kontrak selesai</li>
          <li>• Data finansial ini hanya dapat diakses oleh GM dan Finance Staff</li>
        </ul>
      </div>
    </div>
  );
};

export default RentalRatesPage;
