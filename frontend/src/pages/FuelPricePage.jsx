import React, { useState, useEffect } from 'react';
import { Fuel, Save, History, AlertCircle, CheckCircle, Package, XCircle, Trash2, Info, Edit, Eye } from 'lucide-react';
import { toast } from 'sonner';
import AlertModal from '../components/AlertModal';

/**
 * Fuel Purchase Page
 *
 * Fitur:
 * - Pembelian BBM (oleh Finance)
 * - Persetujuan Pembelian BBM (oleh GM)
 * - Pantau stok BBM saat ini
 * - Riwayat pembelian BBM
 */

const FuelPricePage = () => {
  const [liters, setLiters] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorList, setVendorList] = useState([]);
  const [notes, setNotes] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchases, setPurchases] = useState([]);
  const [stockInfo, setStockInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [editForm, setEditForm] = useState({
    liters: '',
    totalPrice: '',
    pricePerLiter: '',
    vendorName: '',
    purchaseDate: '',
    notes: ''
  });

  // Filter tanggal riwayat pembelian
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0, 8) + '01';
  const [filterStart, setFilterStart] = useState(firstOfMonth);
  const [filterEnd, setFilterEnd] = useState(today);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchPurchases();
      fetchStockInfo();
      fetchVendors();
    }
  }, [currentUser]);

  const fetchVendors = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/fuel/vendors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setVendorList(data);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

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

  const fetchStockInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/fuel/stock', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStockInfo(data);
      }
    } catch (error) {
      console.error('Error fetching stock:', error);
    }
  };

  const fetchPurchases = async (start, end) => {
    const s = start || filterStart;
    const e = end || filterEnd;
    try {
      const token = localStorage.getItem('token');
      let url = '/api/v1/fuel/price';
      if (s && e) url += `?start_date=${s}&end_date=${e}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPurchases(data);
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePurchase = async () => {
    if (!liters || (!totalPrice && !pricePerLiter)) {
      toast.error('Masukkan jumlah liter dan setidaknya salah satu harga (Total atau Per Liter)');
      return;
    }
    if (!purchaseDate) {
      toast.error('Pilih tanggal pembelian');
      return;
    }

    const litersNum = parseFloat(liters);
    let totalPriceNum = parseFloat(totalPrice);
    let pricePerLiterNum = parseFloat(pricePerLiter);

    if (!totalPrice && pricePerLiter) {
      totalPriceNum = litersNum * pricePerLiterNum;
    } else if (!pricePerLiter && totalPrice) {
      pricePerLiterNum = totalPriceNum / litersNum;
    } else {
      pricePerLiterNum = totalPriceNum / litersNum;
    }

    // Kirim tanggal jam 12:00 UTC supaya tidak bergeser karena timezone
    const effectiveDate = purchaseDate + 'T12:00:00.000Z';

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/fuel/price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          price_per_liter: pricePerLiterNum,
          fuel_type: 'solar',
          effective_date: effectiveDate,
          liters: litersNum,
          total_price: totalPriceNum,
          vendor_name: vendorName,
          notes: notes
        })
      });

      if (response.ok) {
        setLiters('');
        setTotalPrice('');
        setPricePerLiter('');
        setVendorName('');
        setNotes('');
        setPurchaseDate(new Date().toISOString().split('T')[0]);
        fetchPurchases();
        if (isGM) {
          toast.success('Pembelian BBM berhasil dicatat dan langsung disetujui');
        } else {
          toast.success('Pembelian BBM berhasil dicatat, menunggu approval GM');
        }
      } else {
        toast.error('Gagal mencatat pembelian BBM');
      }
    } catch (error) {
      console.error('Error saving purchase:', error);
      toast.error('Terjadi kesalahan saat menyimpan');
    }
  };

  const handleAction = async (id, action) => {
    try {
      const token = localStorage.getItem('token');
      let url, method;
      
      if (action === 'approve') {
        url = `/api/v1/fuel/price/${id}/approve?status=approved`;
        method = 'PUT';
      } else if (action === 'reject') {
        url = `/api/v1/fuel/price/${id}/approve?status=rejected`;
        method = 'PUT';
      } else if (action === 'delete') {
        url = `/api/v1/fuel/price/${id}`;
        method = 'DELETE';
      }

      const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchPurchases();
        fetchStockInfo();
        toast.success(`Aksi ${action} berhasil`);
        if (selectedPurchase?.id === id) {
           setIsDetailModalOpen(false);
           setSelectedPurchase(null);
        }
      } else {
        toast.error(`Gagal melakukan aksi`);
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      toast.error('Terjadi kesalahan');
    }
  };

  const deletePurchase = async (priceId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/fuel/price/${priceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Data pembelian berhasil dihapus');
        setIsDeleteModalOpen(false);
        fetchPurchases();
        fetchStockInfo();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Gagal menghapus pembelian');
      }
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast.error('Terjadi kesalahan saat menghapus pembelian');
    }
  };

  const handleEditClick = (purchase, e) => {
    e.stopPropagation();
    setSelectedPurchase(purchase);
    setEditForm({
      liters: purchase.liters || '',
      totalPrice: purchase.total_price || '',
      pricePerLiter: purchase.price_per_liter || '',
      vendorName: purchase.vendor_name || '',
      purchaseDate: purchase.effective_date ? purchase.effective_date.split('T')[0] : '',
      notes: purchase.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const submitEditPurchase = async () => {
    if (!editForm.liters || (!editForm.totalPrice && !editForm.pricePerLiter)) {
      toast.error('Masukkan jumlah liter dan setidaknya salah satu harga');
      return;
    }
    if (!editForm.purchaseDate) {
      toast.error('Pilih tanggal pembelian');
      return;
    }

    const litersNum = parseFloat(editForm.liters);
    let totalPriceNum = parseFloat(editForm.totalPrice);
    let pricePerLiterNum = parseFloat(editForm.pricePerLiter);

    if (!editForm.totalPrice && editForm.pricePerLiter) {
      totalPriceNum = litersNum * pricePerLiterNum;
    } else if (!editForm.pricePerLiter && editForm.totalPrice) {
      pricePerLiterNum = totalPriceNum / litersNum;
    } else {
      pricePerLiterNum = totalPriceNum / litersNum;
    }

    const effectiveDate = editForm.purchaseDate + 'T12:00:00.000Z';

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/fuel/price/${selectedPurchase.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          price_per_liter: pricePerLiterNum,
          liters: litersNum,
          total_price: totalPriceNum,
          effective_date: effectiveDate,
          vendor_name: editForm.vendorName,
          notes: editForm.notes
        })
      });

      if (response.ok) {
        toast.success('Pembelian BBM berhasil diperbarui');
        setIsEditModalOpen(false);
        fetchPurchases();
        fetchStockInfo();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Gagal memperbarui pembelian');
      }
    } catch (error) {
      console.error('Error updating purchase:', error);
      toast.error('Terjadi kesalahan saat memperbarui');
    }
  };

  const isGM = currentUser?.role === 'gm' || currentUser?.role === 'admin' || currentUser?.is_superuser || currentUser?.is_admin;
  const handleApprove = (id) => handleAction(id, 'approve');
  const handleReject = (id) => handleAction(id, 'reject');
  const handleDelete = (id) => handleAction(id, 'delete');

  const openDetail = (purchase) => {
    setSelectedPurchase(purchase);
    setIsDetailModalOpen(true);
  };

  // Check access
  const isFinance = currentUser?.role === 'finance';
  const isGM = currentUser?.role === 'gm' || currentUser?.role === 'admin';
  const hasAccess = isFinance || isGM || currentUser?.is_superuser;

  if (!hasAccess && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle size={64} className="text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
        <p className="text-gray-600">Halaman ini hanya untuk GM dan Finance Staff.</p>
      </div>
    );
  }

  const handleLitersChange = (e) => {
    const val = e.target.value;
    setLiters(val);
    
    if (val && !isNaN(val) && parseFloat(val) > 0) {
      if (pricePerLiter && !isNaN(pricePerLiter)) {
        setTotalPrice((parseFloat(val) * parseFloat(pricePerLiter)).toString());
      } else if (totalPrice && !isNaN(totalPrice)) {
        setPricePerLiter((parseFloat(totalPrice) / parseFloat(val)).toString());
      }
    }
  };

  const handlePricePerLiterChange = (e) => {
    const val = e.target.value;
    setPricePerLiter(val);
    
    if (val && !isNaN(val) && parseFloat(val) > 0) {
      if (liters && !isNaN(liters) && parseFloat(liters) > 0) {
        setTotalPrice((parseFloat(val) * parseFloat(liters)).toString());
      }
    }
  };

  const handleTotalPriceChange = (e) => {
    const val = e.target.value;
    setTotalPrice(val);
    
    if (val && !isNaN(val) && parseFloat(val) > 0) {
      if (liters && !isNaN(liters) && parseFloat(liters) > 0) {
        setPricePerLiter((parseFloat(val) / parseFloat(liters)).toString());
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center">
          <Fuel className="h-6 w-6 sm:h-8 sm:w-8 mr-3 text-amber-500 flex-shrink-0" />
          Pembelian &amp; Stok BBM
        </h1>
        <p className="text-gray-600 mt-2">Catat pembelian BBM, persetujuan, dan pantau ketersediaan stok Solar</p>
      </div>

      {/* Stock Summary */}
      {stockInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-amber-500 min-w-0 fluid-metric-container">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-500 mb-1 truncate">Total Dibeli (Approved)</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 fluid-metric-value">{stockInfo.total_purchased.toLocaleString('id-ID')} L</p>
              </div>
              <Package className="h-10 w-10 text-amber-200 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500 min-w-0 fluid-metric-container">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-500 mb-1 truncate">Total Pemakaian</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 fluid-metric-value">{stockInfo.total_consumed.toLocaleString('id-ID')} L</p>
              </div>
              <Fuel className="h-10 w-10 text-red-200 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500 min-w-0 fluid-metric-container">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-500 mb-1 truncate">Sisa Stok BBM</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600 fluid-metric-value">{stockInfo.current_stock.toLocaleString('id-ID')} L</p>
              </div>
              <CheckCircle className="h-10 w-10 text-green-200 flex-shrink-0" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Pembelian */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
              Catat Pembelian BBM Baru
              {isGM && (
                <span className="ml-2 text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  ✓ Auto-Approve
                </span>
              )}
            </h3>
            <div className="space-y-4">

              {/* Tanggal Pembelian */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Pembelian
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Liter (Solar)</label>
                <input
                  type="number"
                  value={liters}
                  onChange={handleLitersChange}
                  placeholder="Misal: 5000"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga per Liter (Rp)</label>
                  <input
                    type="number"
                    value={pricePerLiter}
                    onChange={handlePricePerLiterChange}
                    placeholder="Misal: 6800"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Harga (Rp)</label>
                  <input
                    type="number"
                    value={totalPrice}
                    onChange={handleTotalPriceChange}
                    placeholder="Misal: 34000000"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor / Penjual</label>
                <input
                  type="text"
                  list="vendor-list"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Ketik manual atau pilih dari daftar"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-amber-500 focus:border-amber-500"
                />
                <datalist id="vendor-list">
                  {vendorList.map((v, idx) => (
                    <option key={idx} value={v} />
                  ))}
                </datalist>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: PO-123 / Supir Budi"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <button
                onClick={handleSavePurchase}
                disabled={!liters || !totalPrice || !purchaseDate}
                className="w-full py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex justify-center items-center font-medium"
              >
                <Save className="h-5 w-5 mr-2" />
                {isGM ? 'Catat & Setujui Pembelian' : 'Submit Pembelian'}
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                {isGM
                  ? '✓ Pembelian oleh GM langsung disetujui dan masuk ke perhitungan stok'
                  : '* Pembelian memerlukan persetujuan GM sebelum masuk ke perhitungan stok'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Tabel Riwayat */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center border-b pb-2">
              <History className="h-5 w-5 mr-2 text-gray-500" />
              Riwayat Pembelian
            </h3>

            {/* Filter Tanggal */}
            <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={filterStart}
                  onChange={(e) => setFilterStart(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={filterEnd}
                  onChange={(e) => setFilterEnd(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                onClick={() => fetchPurchases(filterStart, filterEnd)}
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                <History className="h-4 w-4" />
                Filter
              </button>
              <button
                onClick={() => { setFilterStart(''); setFilterEnd(''); fetchPurchases('', ''); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Semua
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Tanggal</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Vendor</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Liter</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Harga/Liter</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Total Harga</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {purchases.map((purchase) => (
                    <tr 
                      key={purchase.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openDetail(purchase)}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {purchase.effective_date
                          ? new Date(purchase.effective_date).toLocaleDateString('id-ID')
                          : new Date(purchase.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {purchase.vendor_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right whitespace-nowrap">
                        {purchase.liters?.toLocaleString('id-ID') || '-'} L
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-right whitespace-nowrap">
                        Rp {purchase.price_per_liter.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right whitespace-nowrap">
                        Rp {purchase.total_price?.toLocaleString('id-ID') || '-'}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {purchase.approval_status === 'approved' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Approved
                          </span>
                        ) : purchase.approval_status === 'rejected' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); openDetail(purchase); }}
                            className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 px-2 py-1 rounded bg-blue-50 flex items-center gap-1"
                            title="Detail"
                          >
                            <Eye size={14} /> Detail
                          </button>
                          
                          {(isGM || purchase.approval_status === 'pending') && (
                            <button
                              onClick={(e) => handleEditClick(purchase, e)}
                              className="text-xs text-amber-500 hover:text-amber-700 border border-amber-200 px-2 py-1 rounded bg-amber-50 flex items-center gap-1"
                              title="Edit"
                            >
                              <Edit size={14} /> Edit
                            </button>
                          )}

                        {purchase.approval_status === 'pending' && isGM && (
                          <>
                            <button
                              onClick={() => handleApprove(purchase.id)}
                              className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPurchase(purchase);
                                setIsRejectModalOpen(true);
                              }}
                              className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                            >
                              Tolak
                            </button>
                          </>
                        )}
                        {purchase.approval_status === 'pending' && !isGM && (
                          <span className="text-xs text-gray-400">Menunggu</span>
                        )}
                        {isGM && purchase.approval_status !== 'pending' && (
                           <button
                             onClick={() => {
                               setSelectedPurchase(purchase);
                               setIsDeleteModalOpen(true);
                             }}
                             className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded bg-red-50 flex items-center gap-1"
                             title="Hapus"
                           >
                             <Trash2 size={14} /> Hapus
                           </button>
                        )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {purchases.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        Belum ada riwayat pembelian
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                <Info className="w-5 h-5 mr-2 text-blue-500" />
                Detail Pembelian BBM
              </h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Tanggal</p>
                  <p className="font-semibold text-gray-800">{new Date(selectedPurchase.effective_date).toLocaleDateString('id-ID')}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <p className="font-semibold text-gray-800">
                    {selectedPurchase.approval_status === 'approved' ? (
                      <span className="text-green-600">Disetujui</span>
                    ) : selectedPurchase.approval_status === 'rejected' ? (
                      <span className="text-red-600">Ditolak</span>
                    ) : (
                      <span className="text-yellow-600">Menunggu</span>
                    )}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Total Liter</p>
                  <p className="font-semibold text-gray-800">{selectedPurchase.liters?.toLocaleString('id-ID')} L</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Harga per Liter</p>
                  <p className="font-semibold text-gray-800">Rp {selectedPurchase.price_per_liter?.toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg col-span-2">
                  <p className="text-xs text-amber-600 mb-1">Total Harga</p>
                  <p className="font-bold text-amber-700 text-lg">Rp {selectedPurchase.total_price?.toLocaleString('id-ID')}</p>
                </div>
                {selectedPurchase.vendor_name && (
                  <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Vendor / Penjual</p>
                    <p className="font-medium text-gray-800">{selectedPurchase.vendor_name}</p>
                  </div>
                )}
                {selectedPurchase.notes && (
                  <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Catatan</p>
                    <p className="font-medium text-gray-800">{selectedPurchase.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Tutup
              </button>
              {selectedPurchase.approval_status === 'pending' && isGM && (
                <>
                  <button
                    onClick={() => { setIsDetailModalOpen(false); setIsRejectModalOpen(true); }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Tolak
                  </button>
                  <button
                    onClick={() => { setIsDetailModalOpen(false); handleApprove(selectedPurchase.id); }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Setujui
                  </button>
                </>
              )}
              {selectedPurchase.approval_status !== 'pending' && isGM && (
                <button
                  onClick={() => { setIsDetailModalOpen(false); setIsDeleteModalOpen(true); }}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus Data
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                <Edit className="w-5 h-5 mr-2 text-amber-500" />
                Edit Pembelian BBM
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal Pembelian <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={editForm.purchaseDate}
                    onChange={(e) => setEditForm({...editForm, purchaseDate: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Vendor / Penjual</label>
                  <input
                    type="text"
                    list="edit-vendor-list"
                    value={editForm.vendorName}
                    onChange={(e) => setEditForm({...editForm, vendorName: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="Contoh: Pertamina SPBU 14..."
                  />
                  <datalist id="edit-vendor-list">
                    {vendorList.map((vendor, index) => (
                      <option key={index} value={vendor} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Jumlah Liter <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.liters}
                    onChange={(e) => setEditForm({...editForm, liters: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-2 text-gray-500 text-sm">L</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Harga per Liter</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={editForm.pricePerLiter}
                      onChange={(e) => setEditForm({...editForm, pricePerLiter: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Total Harga</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={editForm.totalPrice}
                      onChange={(e) => setEditForm({...editForm, totalPrice: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-amber-600 -mt-2 bg-amber-50 p-1.5 rounded border border-amber-100">
                Tip: Isi Total Harga saja atau Harga per Liter saja, sistem akan menghitung otomatis.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Catatan Tambahan</label>
                <textarea
                  rows="2"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Opsional..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Batal
              </button>
              <button
                onClick={submitEditPurchase}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      <AlertModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={() => {
          setIsRejectModalOpen(false);
          handleReject(selectedPurchase.id);
        }}
        title="Tolak Pembelian BBM"
        message="Anda yakin ingin menolak pembelian BBM ini? Data pembelian akan masuk ke riwayat sebagai ditolak dan stok tidak akan bertambah."
        confirmText="Tolak Pembelian"
        cancelText="Batal"
        confirmColor="bg-red-600 hover:bg-red-700"
      />

      {/* Delete Modal */}
      <AlertModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          setIsDeleteModalOpen(false);
          handleDelete(selectedPurchase.id);
        }}
        title="Hapus Pembelian BBM"
        message="Anda yakin ingin menghapus data pembelian BBM ini secara permanen?"
        confirmText="Hapus Permanen"
        cancelText="Batal"
        confirmColor="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};

export default FuelPricePage;
