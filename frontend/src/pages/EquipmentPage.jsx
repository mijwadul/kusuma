import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, Fuel, Eye, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "../api/auth";
import AlertModal from "../components/AlertModal";
import EquipmentDetailModal from "../components/EquipmentDetailModal";

const EquipmentPage = () => {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEquipmentId, setDeleteEquipmentId] = useState(null);
  const [showBrandDeleteModal, setShowBrandDeleteModal] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [fuelReport, setFuelReport] = useState([]);
  const [userRole, setUserRole] = useState("user"); // Simulasi role user
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationInputRef = useRef(null);
  const [brands, setBrands] = useState(() => {
    const saved = localStorage.getItem("equipmentBrands");
    return saved
      ? JSON.parse(saved)
      : ["Caterpillar", "Komatsu", "Hitachi", "Volvo", "JCB"];
  });
  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    type: "",
    capacity: "",
    location: "",
    status: "active",
    ownership_status: "internal",
    rental_rate_per_hour: "",
    deposit_amount: "",
    vendor_id: "",
  });

  useEffect(() => {
    fetchEquipment();
    fetchFuelReport();
  }, []);

  // Kumpulkan lokasi unik dari data equipment yang sudah ada
  const locationSuggestions = useMemo(() => {
    const locs = equipment
      .map((e) => e.location)
      .filter((loc) => loc && loc.trim() !== "");
    return [...new Set(locs)].sort();
  }, [equipment]);

  // Filter saran berdasarkan input
  const filteredLocations = locationSuggestions.filter((loc) =>
    loc.toLowerCase().includes((formData.location || "").toLowerCase()),
  );

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        locationInputRef.current &&
        !locationInputRef.current.contains(e.target)
      ) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchFuelReport = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/fuel/equipment-report`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setFuelReport(data);
      }
    } catch (error) {
      console.error("Error fetching fuel report:", error);
    }
  };

  const fetchEquipment = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/equipment`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setEquipment(data);
      }
    } catch (error) {
      console.error("Error fetching equipment:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const url = editingEquipment
      ? `${API_URL}/equipment/${editingEquipment.id}`
      : `${API_URL}/equipment`;
    const method = editingEquipment ? "PUT" : "POST";

    try {
      // Convert empty strings to null for decimal fields to avoid 422 validation errors
      const payload = {
        ...formData,
        capacity:
          formData.capacity === "" ? null : parseFloat(formData.capacity),
        rental_rate_per_hour:
          formData.rental_rate_per_hour === ""
            ? null
            : formData.rental_rate_per_hour,
        deposit_amount:
          formData.deposit_amount === "" ? null : formData.deposit_amount,
        vendor_id: formData.vendor_id === "" ? null : formData.vendor_id,
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        fetchEquipment();
        setShowForm(false);
        setEditingEquipment(null);
        resetForm();
        toast.success(
          editingEquipment
            ? "Equipment berhasil diupdate!"
            : "Equipment berhasil ditambahkan!",
        );
      } else if (response.status === 422) {
        const errorData = await response.json();
        toast.error(
          `Validasi gagal: ${errorData.detail?.map?.((e) => e.msg || e).join(", ") || "Data tidak valid"}`,
        );
      } else {
        toast.error("Gagal menyimpan equipment");
      }
    } catch (error) {
      console.error("Error saving equipment:", error);
      toast.error("Terjadi kesalahan saat menyimpan equipment");
    }
  };

  const handleEdit = (item) => {
    setEditingEquipment(item);
    setFormData({
      name: item.name,
      brand: item.brand || "",
      type: item.type,
      capacity: item.capacity || "",
      location: item.location || "",
      status: item.status,
      ownership_status: item.ownership_status || "internal",
      rental_rate_per_hour: item.rental_rate_per_hour || "",
      deposit_amount: item.deposit_amount || "",
      vendor_id: item.vendor_id || "",
    });
    setShowForm(true);
  };

  const handleViewDetail = (item) => {
    setSelectedEquipment(item);
    setShowDetailModal(true);
  };

  const handleDelete = (id) => {
    setDeleteEquipmentId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteEquipmentId) return;

    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        `${API_URL}/equipment/${deleteEquipmentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        fetchEquipment();
        toast.success("Equipment berhasil dihapus!");
        setShowDeleteModal(false);
        setDeleteEquipmentId(null);
      }
    } catch (error) {
      console.error("Error deleting equipment:", error);
    }
  };

  const addNewBrand = (newBrand) => {
    if (newBrand && !brands.includes(newBrand)) {
      const updatedBrands = [...brands, newBrand];
      setBrands(updatedBrands);
      localStorage.setItem("equipmentBrands", JSON.stringify(updatedBrands));
      setFormData({ ...formData, brand: newBrand });
    }
  };

  const handleDeleteBrand = (brand) => {
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
      deposit_amount: "",
      vendor_id: "",
    });
  };

  const openAddForm = () => {
    setEditingEquipment(null);
    resetForm();
    setShowForm(true);
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Equipment Management
          </h1>
          <div className="mt-2 flex items-center space-x-2">
            <span className="text-sm text-gray-600">Role saat ini:</span>
            <span
              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                userRole === "admin"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {userRole === "admin" ? "Admin" : "Operator"}
            </span>
            <button
              onClick={() =>
                setUserRole(userRole === "admin" ? "user" : "admin")
              }
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Ganti Role
            </button>
          </div>
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
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Brand
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Capacity (Ton)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kepemilikan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Liter/Jam
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                BBM Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {equipment.map((item) => {
              const report =
                fuelReport.find((row) => row.equipment_id === item.id) || {};
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

      {showForm && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full"
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
                          addNewBrand(e.target.value);
                          e.target.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = e.target.previousElementSibling;
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
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Nilai Deposit
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.deposit_amount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            deposit_amount: e.target.value,
                          })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Vendor ID
                      </label>
                      <input
                        type="number"
                        value={formData.vendor_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            vendor_id: e.target.value,
                          })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        placeholder="Opsional"
                      />
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
            ? fuelReport.find((r) => r.equipment_id === selectedEquipment.id) ||
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
