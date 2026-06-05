import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, Fuel, Eye, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import AlertModal from "../components/AlertModal";
import EquipmentDetailModal from "../components/EquipmentDetailModal";
import VendorManagement from "../components/VendorManagement";
import { useCurrentUser } from "../hooks/useAuth";
import { useEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment, useEquipmentFuelReport, Equipment } from "../hooks/useEquipment";
import { useVendors } from "../hooks/useVendors";

const EquipmentPage = () => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [deleteEquipmentId, setDeleteEquipmentId] = useState<number | null>(null);
  const [showBrandDeleteModal, setShowBrandDeleteModal] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<string | null>(null);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationInputRef = useRef<HTMLDivElement>(null);
  
  const [brands, setBrands] = useState<string[]>(() => {
    const saved = localStorage.getItem("equipmentBrands");
    return saved
      ? JSON.parse(saved)
      : ["Caterpillar", "Komatsu", "Hitachi", "Volvo", "JCB"];
  });

  const { data: currentUser } = useCurrentUser();
  const userRole = currentUser?.role;

  const { data: equipmentList = [], isLoading: loadingEquipment } = useEquipment();
  const { data: fuelReport = [] } = useEquipmentFuelReport();
  const { data: vendorsList = [] } = useVendors();

  const createMutation = useCreateEquipment();
  const updateMutation = useUpdateEquipment();
  const deleteMutation = useDeleteEquipment();

  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    type: "",
    capacity: "",
    location: "",
    status: "active",
    ownership_status: "internal",
    rental_rate_per_hour: "",
    pending_rental_rate_per_hour: "",
    vendor_id: "",
  });

  const locationSuggestions = useMemo(() => {
    const locs = equipmentList
      .map((e) => e.location)
      .filter((loc): loc is string => !!loc && loc.trim() !== "");
    return [...new Set(locs)].sort();
  }, [equipmentList]);

  const filteredLocations = locationSuggestions.filter((loc) =>
    loc.toLowerCase().includes((formData.location || "").toLowerCase()),
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        locationInputRef.current &&
        !locationInputRef.current.contains(e.target as Node)
      ) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      capacity: formData.capacity === "" ? undefined : parseFloat(formData.capacity),
      rental_rate_per_hour: formData.rental_rate_per_hour === "" ? undefined : parseFloat(formData.rental_rate_per_hour),
      pending_rental_rate_per_hour: formData.pending_rental_rate_per_hour === "" ? null : parseFloat(formData.pending_rental_rate_per_hour),
      vendor_id: formData.vendor_id === "" ? undefined : parseInt(formData.vendor_id),
    };

    if (editingEquipment) {
      updateMutation.mutate(
        { id: editingEquipment.id, data: payload as any },
        {
          onSuccess: () => {
            setShowForm(false);
            setEditingEquipment(null);
            resetForm();
            toast.success("Equipment berhasil diupdate!");
          },
          onError: (error: any) => {
            if (error.response?.status === 422) {
              const errData = error.response.data;
              toast.error(`Validasi gagal: ${errData.detail?.map?.((e: any) => e.msg || e).join(", ") || "Data tidak valid"}`);
            } else {
              toast.error("Gagal menyimpan equipment");
            }
          }
        }
      );
    } else {
      createMutation.mutate(
        payload as any,
        {
          onSuccess: () => {
            setShowForm(false);
            setEditingEquipment(null);
            resetForm();
            toast.success("Equipment berhasil ditambahkan!");
          },
          onError: (error: any) => {
            if (error.response?.status === 422) {
              const errData = error.response.data;
              toast.error(`Validasi gagal: ${errData.detail?.map?.((e: any) => e.msg || e).join(", ") || "Data tidak valid"}`);
            } else {
              toast.error("Gagal menyimpan equipment");
            }
          }
        }
      );
    }
  };

  const handleEdit = (item: Equipment) => {
    setEditingEquipment(item);
    setFormData({
      name: item.name,
      brand: item.brand || "",
      type: item.type,
      capacity: item.capacity?.toString() || "",
      location: item.location || "",
      status: item.status,
      ownership_status: item.ownership_status || "internal",
      rental_rate_per_hour: item.rental_rate_per_hour?.toString() || "",
      pending_rental_rate_per_hour: item.pending_rental_rate_per_hour?.toString() || "",
      vendor_id: item.vendor_id?.toString() || "",
    });
    setShowForm(true);
  };

  const handleViewDetail = (item: Equipment) => {
    setSelectedEquipment(item);
    setShowDetailModal(true);
  };

  const handleDelete = (id: number) => {
    setDeleteEquipmentId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!deleteEquipmentId) return;
    deleteMutation.mutate(deleteEquipmentId, {
      onSuccess: () => {
        toast.success("Equipment berhasil dihapus!");
        setShowDeleteModal(false);
        setDeleteEquipmentId(null);
      },
      onError: () => {
        toast.error("Gagal menghapus equipment");
      }
    });
  };

  const addNewBrand = (newBrand: string) => {
    if (newBrand && !brands.includes(newBrand)) {
      const updatedBrands = [...brands, newBrand];
      setBrands(updatedBrands);
      localStorage.setItem("equipmentBrands", JSON.stringify(updatedBrands));
      setFormData({ ...formData, brand: newBrand });
    }
  };

  const handleDeleteBrand = (brand: string) => {
    setBrandToDelete(brand);
    setShowBrandDeleteModal(true);
  };

  const confirmDeleteBrand = () => {
    if (!brandToDelete) return;
    const updatedBrands = brands.filter((b) => b !== brandToDelete);
    setBrands(updatedBrands);
    localStorage.setItem("equipmentBrands", JSON.stringify(updatedBrands));
    if (formData.brand === brandToDelete) {
      setFormData({ ...formData, brand: "" });
    }
    setShowBrandDeleteModal(false);
    setBrandToDelete(null);
    toast.success(`Merk ${brandToDelete} berhasil dihapus`);
  };

  const equipmentTypes = [
    "Excavator (Bucket)",
    "Excavator (Breaker)",
    "Loader",
    "Truck",
    "Bulldozer",
    "Crane",
    "Forklift",
  ];

  const capacityOptions = [20, 30, 40, 50];

  const resetForm = () => {
    setFormData({
      name: "",
      brand: "",
      type: "",
      capacity: "",
      location: "",
      status: "active",
      ownership_status: "internal",
      rental_rate_per_hour: "",
      pending_rental_rate_per_hour: "",
      vendor_id: "",
    });
  };

  const openAddForm = () => {
    setEditingEquipment(null);
    resetForm();
    setShowForm(true);
  };

  if (loadingEquipment) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Equipment Management
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/fuel")}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-md"
          >
            <Fuel size={20} />
            <span>Catat Isi Solar</span>
          </button>
          <button
            onClick={openAddForm}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>Add Equipment</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50 whitespace-nowrap">
            <tr>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider ">
                Name
              </th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider ">
                Brand
              </th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider ">
                Type
              </th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider ">
                Capacity (Ton)
              </th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider ">
                Location
              </th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider ">
                Status
              </th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider ">
                Kepemilikan
              </th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider ">
                Liter/Jam
              </th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider ">
                BBM Status
              </th>
              <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider ">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[...equipmentList].sort((a, b) => a.name.localeCompare(b.name)).map((item) => {
              const report =
                fuelReport.find((row: any) => row.equipment_id === item.id) || {};
              const lph = report.liter_per_hour;
              const isAnomaly = report.status_anomali;
              const hasLph = typeof lph === "number";
              const progressValue = hasLph
                ? Math.min((lph / 35) * 100, 100)
                : 0;
              const statusLabel = isAnomaly
                ? "Anomali"
                : hasLph
                  ? "Normal"
                  : "Perlu Data";
              const badgeClasses = isAnomaly
                ? "bg-red-100 text-red-800"
                : hasLph
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800";

              return (
                <tr
                  key={item.id}
                  onClick={() => handleViewDetail(item)}
                  className="cursor-pointer hover:bg-blue-50 transition-colors"
                  title="Klik untuk melihat detail"
                >
                  <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.brand || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.capacity ? `${item.capacity} Ton` : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        item.status === "active"
                          ? "bg-green-100 text-green-800"
                          : item.status === "maintenance"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        (item.ownership_status || "internal") === "internal"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {(item.ownership_status || "internal") === "internal"
                        ? "[Milik]"
                        : "[Rental]"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <span>{hasLph ? lph.toFixed(2) : "-"}</span>
                      {isAnomaly && (
                        <AlertTriangle
                          size={16}
                          className="text-red-600"
                          title={report.pesan_alert || "Konsumsi tidak wajar"}
                        />
                      )}
                    </div>
                    <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${isAnomaly ? "bg-red-500" : "bg-emerald-500"}`}
                        style={{ width: `${progressValue}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClasses}`}
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/fuel?equipment=${item.id}`);
                        }}
                        className="text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 p-1.5 rounded transition-colors"
                        title="Isi BBM"
                      >
                        <Fuel size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetail(item);
                        }}
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors"
                        title="Lihat Detail"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(item);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      
      {userRole && <VendorManagement userRole={userRole} />}

      {showForm && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={() => setShowForm(false)}
        >
          <div
            className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingEquipment ? "Edit Equipment" : "Add New Equipment"}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Brand
                  </label>
                  <select
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  >
                    <option value="">Select Brand</option>
                    {brands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 flex space-x-2">
                    <input
                      type="text"
                      placeholder="Add new brand"
                      className="flex-1 border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addNewBrand(e.currentTarget.value);
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        addNewBrand(input.value);
                        input.value = "";
                      }}
                      className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                    >
                      Add
                    </button>
                  </div>
                  {brands.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {brands.map((brand) => (
                        <div
                          key={brand}
                          className="inline-flex items-center bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-700 border border-gray-200"
                        >
                          <span>{brand}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteBrand(brand)}
                            className="ml-1.5 text-gray-400 hover:text-red-500 focus:outline-none"
                            title="Hapus merk"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    required
                  >
                    <option value="">Select Type</option>
                    {equipmentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Capacity (Ton)
                  </label>
                  <select
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  >
                    <option value="">Select Capacity</option>
                    {capacityOptions.map((cap) => (
                      <option key={cap} value={cap}>
                        {cap} Ton
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Location
                  </label>
                  <div className="relative" ref={locationInputRef}>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => {
                        setFormData({ ...formData, location: e.target.value });
                        setShowLocationDropdown(true);
                      }}
                      onFocus={() => setShowLocationDropdown(true)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      placeholder="Ketik atau pilih lokasi..."
                      autoComplete="off"
                    />
                    {showLocationDropdown && filteredLocations.length > 0 && (
                      <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredLocations.map((loc) => (
                          <li
                            key={loc}
                            className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm text-gray-700"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setFormData({ ...formData, location: loc });
                              setShowLocationDropdown(false);
                            }}
                          >
                            {loc}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Status Kepemilikan
                  </label>
                  <select
                    value={formData.ownership_status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ownership_status: e.target.value,
                      })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  >
                    <option value="internal">Milik Sendiri</option>
                    <option value="rental">Sewa/Rental</option>
                  </select>
                </div>

                {formData.ownership_status === "rental" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Tarif Rental (Per Jam)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.rental_rate_per_hour}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rental_rate_per_hour: e.target.value,
                          })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        placeholder="0.00"
                      />
                      {editingEquipment && (
                         <p className="text-xs text-gray-500 mt-1">
                           Catatan: Jika ada saldo positif, perubahan harga akan masuk antrian otomatis.
                         </p>
                      )}
                    </div>
                    {editingEquipment?.pending_rental_rate_per_hour != null && (
                      <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                        <label className="block text-sm font-medium text-yellow-800 flex items-center gap-1">
                          <AlertTriangle size={16} />
                          Harga Antrian (Edit/Batal)
                        </label>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            step="0.01"
                            value={formData.pending_rental_rate_per_hour}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                pending_rental_rate_per_hour: e.target.value,
                              })
                            }
                            className="block w-full border border-yellow-300 rounded-md shadow-sm p-2"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, pending_rental_rate_per_hour: "" })}
                            className="bg-red-100 text-red-600 px-3 py-2 rounded text-sm hover:bg-red-200"
                            title="Batalkan antrian harga"
                          >
                            Batal
                          </button>
                        </div>
                        <p className="text-xs text-yellow-700 mt-1">
                          Saldo terkunci: {editingEquipment.locked_balance_for_pending_rate?.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Vendor Perusahaan Sewa
                      </label>
                      <select
                        value={formData.vendor_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            vendor_id: e.target.value,
                          })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      >
                        <option value="">-- Pilih Vendor --</option>
                        {vendorsList.map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editingEquipment ? "Update" : "Add"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Konfirmasi Hapus"
        message="Apakah Anda yakin ingin menghapus equipment ini?"
        confirmText="Hapus"
        cancelText="Batal"
      />

      <AlertModal
        isOpen={showBrandDeleteModal}
        onClose={() => setShowBrandDeleteModal(false)}
        onConfirm={confirmDeleteBrand}
        title="Konfirmasi Hapus Merk"
        message={`Apakah Anda yakin ingin menghapus merk "${brandToDelete}"?`}
        confirmText="Hapus"
        cancelText="Batal"
      />

      <EquipmentDetailModal
        equipment={selectedEquipment}
        fuelData={
          selectedEquipment
            ? fuelReport.find((r: any) => r.equipment_id === selectedEquipment.id) ||
              null
            : null
        }
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedEquipment(null);
        }}
        userRole={userRole}
      />
    </div>
  );
};

export default EquipmentPage;
