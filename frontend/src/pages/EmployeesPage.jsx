import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, User, DollarSign, Calendar, CreditCard, AlertCircle, 
         Search, Filter, Download, TrendingUp, Briefcase, MapPin, Phone, Mail, 
         CheckCircle, XCircle, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import AlertModal from '../components/AlertModal';

/**
 * Employees Page - Bina-ERP Employee Management
 * 
 * Features:
 * - Employee CRUD (Admin/HR)
 * - Payroll Management (Finance/GM)
 * - Attendance Tracking (All)
 * - Loan/Debt Management (Finance/GM)
 * 
 * Role Access:
 * - GM: Full access (all features)
 * - Finance: View financial data, process payroll
 * - Admin/HR: CRUD employee (no financial data view)
 * - Field: No access
 */

const TABS = {
  EMPLOYEES: 'employees',
  PAYROLL: 'payroll',
  ATTENDANCE: 'attendance',
  LOANS: 'loans'
};

const EmployeesPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS.EMPLOYEES);
  const [loading, setLoading] = useState(true);
  
  // Employee state
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState(null);
  
  // Payroll state
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [selectedEmployeeForPayroll, setSelectedEmployeeForPayroll] = useState(null);
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [payrollCalculation, setPayrollCalculation] = useState(null);
  
  // Form states - Comprehensive employee form (personal + financial)
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    email: '',
    phone: '',
    nik: '',
    address: '',
    date_of_birth: '',
    place_of_birth: '',
    gender: '',
    marital_status: '',
    position: '',
    department: '',
    employment_type: 'permanent',
    join_date: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    // Financial fields
    daily_salary: '',
    hourly_overtime_rate: '',
    loan_balance: '',
    loan_deduction_per_period: '',
    debt_to_company: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: ''
  });
  
  // Finance form (data finansial terpisah)
  const [financeForm, setFinanceForm] = useState({
    daily_salary: '',
    hourly_overtime_rate: '',
    loan_balance: '',
    loan_deduction_per_period: '',
    debt_to_company: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: ''
  });
  
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [selectedEmployeeForFinance, setSelectedEmployeeForFinance] = useState(null);
  
  const [payrollForm, setPayrollForm] = useState({
    employee_id: '',
    period_start: '',
    period_end: '',
    overtime_hours: '',
    bonus: '',
    allowance: '',
    loan_deduction: '',
    other_deduction: '',
    deduction_note: '',
    notes: ''
  });

  // Loan state
  const [loans, setLoans] = useState([]);
  const [selectedEmployeeForLoan, setSelectedEmployeeForLoan] = useState(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [loanForm, setLoanForm] = useState({
    nominal: '',
    loan_date: '',
    deduction_per_period: '',
    notes: ''
  });
  const [deleteLoanId, setDeleteLoanId] = useState(null);
  const [showDeleteLoanModal, setShowDeleteLoanModal] = useState(false);

  // Fetch current user
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Fetch data based on active tab
  useEffect(() => {
    if (currentUser) {
      if (activeTab === TABS.EMPLOYEES) {
        fetchEmployees();
      } else if (activeTab === TABS.PAYROLL && canAccessFinancial) {
        fetchPayrollRecords();
        fetchEmployees();
      } else if (activeTab === TABS.LOANS && canAccessFinancial) {
        fetchLoans(selectedEmployeeForLoan?.id);
        fetchEmployees();
      }
    }
  }, [currentUser, activeTab]);

  // Filter employees
  useEffect(() => {
    let filtered = employees;
    
    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (departmentFilter) {
      filtered = filtered.filter(emp => emp.department === departmentFilter);
    }
    
    setFilteredEmployees(filtered);
  }, [employees, searchTerm, departmentFilter]);

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
      console.error('Error fetching current user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/employees/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      } else {
        toast.error('Gagal memuat data karyawan');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Terjadi kesalahan saat memuat data');
    }
  };

  const fetchEmployeeDetail = async (employeeId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/employees/employees/${employeeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedEmployeeDetail(data);
      } else {
        toast.error('Gagal memuat detail karyawan');
      }
    } catch (error) {
      console.error('Error fetching employee detail:', error);
      toast.error('Terjadi kesalahan saat memuat detail karyawan');
    }
  };

  const fetchPayrollRecords = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/employees/payroll', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPayrollRecords(data);
      }
    } catch (error) {
      console.error('Error fetching payroll:', error);
    }
  };

  const fetchLoans = async (employeeId = null) => {
    try {
      const token = localStorage.getItem('token');
      const url = employeeId 
        ? `/api/v1/employees/loans/employee/${employeeId}`
        : `/api/v1/employees/loans`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLoans(data);
      } else {
        toast.error('Gagal memuat data pinjaman');
      }
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast.error('Terjadi kesalahan saat memuat data pinjaman');
    }
  };

  // Role checks
  const isGM = currentUser?.role === 'gm' || currentUser?.role === 'admin' || currentUser?.is_admin;
  const isFinance = currentUser?.role === 'finance' || currentUser?.role === 'checker' || isGM;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'gm' || isGM;
  const canAccessFinancial = isFinance;
  const canManageEmployees = isAdmin;

  // Form handlers
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();

    if (!employeeForm.name || !employeeForm.email) {
      toast.error('Nama dan email harus diisi');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const url = editingEmployee 
        ? `/api/v1/employees/employees/${editingEmployee.id}`
        : '/api/v1/employees/employees';
      
      const method = editingEmployee ? 'PUT' : 'POST';
      
      // Remove empty strings so optional fields don't trigger validation errors
      // Also remove read-only calculated fields
      const readonlyFields = ['loan_balance', 'loan_deduction_per_period', 'debt_to_company'];
      const formData = Object.entries(employeeForm).reduce((acc, [key, value]) => {
        if (value === '' || value === null || value === undefined) return acc;
        if (readonlyFields.includes(key)) return acc;
        acc[key] = value;
        return acc;
      }, {});
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast.success(editingEmployee ? 'Karyawan berhasil diupdate' : 'Karyawan berhasil ditambahkan');
        setShowEmployeeForm(false);
        resetEmployeeForm();
        await fetchEmployees();
        if (editingEmployee?.id) {
          await fetchEmployeeDetail(editingEmployee.id);
        }
      } else {
        const error = await response.json();
        const errorMessage = typeof error.detail === 'string'
          ? error.detail
          : Array.isArray(error.detail)
            ? error.detail.map(err => err.msg || JSON.stringify(err)).join(', ')
            : JSON.stringify(error.detail);
        toast.error(errorMessage || 'Gagal menyimpan data karyawan');
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('Terjadi kesalahan saat menyimpan');
    }
  };

  const preparePayrollPayload = () => {
    const payload = { ...payrollForm };
    const floatFields = ['overtime_hours', 'bonus', 'allowance', 'loan_deduction', 'other_deduction'];
    floatFields.forEach(field => {
      if (payload[field] === '') {
        delete payload[field];
      } else {
        payload[field] = parseFloat(payload[field]);
      }
    });
    return payload;
  };

  const handleCalculatePayroll = async () => {
    try {
      const token = localStorage.getItem('token');
      const payload = preparePayrollPayload();
      const response = await fetch('/api/v1/employees/payroll/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        setPayrollCalculation(data);
      } else {
        toast.error('Gagal menghitung payroll');
      }
    } catch (error) {
      console.error('Error calculating payroll:', error);
      toast.error('Terjadi kesalahan saat menghitung');
    }
  };

  const handleCreatePayroll = async () => {
    try {
      const token = localStorage.getItem('token');
      const payload = preparePayrollPayload();
      const response = await fetch('/api/v1/employees/payroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        toast.success('Payroll berhasil dibuat');
        setShowPayrollForm(false);
        resetPayrollForm();
        fetchPayrollRecords();
      } else {
        toast.error('Gagal membuat payroll');
      }
    } catch (error) {
      console.error('Error creating payroll:', error);
      toast.error('Terjadi kesalahan saat membuat payroll');
    }
  };

  const handleDeleteEmployee = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/employees/employees/${deleteEmployeeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Karyawan berhasil dihapus');
        setShowDeleteModal(false);
        fetchEmployees();
      } else {
        toast.error('Gagal menghapus karyawan');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Terjadi kesalahan saat menghapus');
    }
  };

  const openEditForm = async (employee) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/employees/employees/${employee.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const fullEmployeeData = await response.json();
        setEditingEmployee(fullEmployeeData);
        setEmployeeForm({
          name: fullEmployeeData.name || '',
          email: fullEmployeeData.email || '',
          phone: fullEmployeeData.phone || '',
          nik: fullEmployeeData.nik || '',
          address: fullEmployeeData.address || '',
          date_of_birth: fullEmployeeData.date_of_birth || '',
          place_of_birth: fullEmployeeData.place_of_birth || '',
          gender: fullEmployeeData.gender || '',
          marital_status: fullEmployeeData.marital_status || '',
          position: fullEmployeeData.position || '',
          department: fullEmployeeData.department || '',
          employment_type: fullEmployeeData.employment_type || 'permanent',
          join_date: fullEmployeeData.join_date || '',
          emergency_contact_name: fullEmployeeData.emergency_contact_name || '',
          emergency_contact_phone: fullEmployeeData.emergency_contact_phone || '',
          emergency_contact_relation: fullEmployeeData.emergency_contact_relation || '',
          // Financial fields
          daily_salary: fullEmployeeData.daily_salary || '',
          hourly_overtime_rate: fullEmployeeData.hourly_overtime_rate || '',
          loan_balance: fullEmployeeData.loan_balance || '',
          loan_deduction_per_period: fullEmployeeData.loan_deduction_per_period || '',
          debt_to_company: fullEmployeeData.debt_to_company || '',
          bank_name: fullEmployeeData.bank_name || '',
          bank_account_number: fullEmployeeData.bank_account_number || '',
          bank_account_name: fullEmployeeData.bank_account_name || ''
        });
        setShowEmployeeForm(true);
      } else {
        toast.error('Gagal memuat data karyawan');
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast.error('Terjadi kesalahan saat memuat data karyawan');
    }
  };
  
  const openFinanceModal = (employee) => {
    setSelectedEmployeeForFinance(employee);
    setFinanceForm({
      daily_salary: employee.daily_salary || '',
      hourly_overtime_rate: employee.hourly_overtime_rate || '',
      loan_balance: employee.loan_balance || '',
      loan_deduction_per_period: employee.loan_deduction_per_period || '',
      debt_to_company: employee.debt_to_company || '',
      bank_name: employee.bank_name || '',
      bank_account_number: employee.bank_account_number || '',
      bank_account_name: employee.bank_account_name || ''
    });
    setShowFinanceModal(true);
  };

  const openEmployeeDetail = async (employee) => {
    setShowDetailModal(true);
    await fetchEmployeeDetail(employee.id);
  };

  const closeEmployeeDetail = () => {
    setSelectedEmployeeDetail(null);
    setShowDetailModal(false);
  };
  
  const handleFinanceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployeeForFinance) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/employees/employees/${selectedEmployeeForFinance.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          daily_salary: financeForm.daily_salary === '' ? null : parseFloat(financeForm.daily_salary),
          hourly_overtime_rate: financeForm.hourly_overtime_rate === '' ? null : parseFloat(financeForm.hourly_overtime_rate),
          bank_name: financeForm.bank_name || null,
          bank_account_number: financeForm.bank_account_number || null,
          bank_account_name: financeForm.bank_account_name || null
        })
      });
      
      if (response.ok) {
        toast.success('Data finansial berhasil diupdate');
        setShowFinanceModal(false);
        resetFinanceForm();
        fetchEmployees();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Gagal menyimpan data finansial');
      }
    } catch (error) {
      console.error('Error saving finance data:', error);
      toast.error('Terjadi kesalahan saat menyimpan');
    }
  };

  const resetEmployeeForm = () => {
    setEditingEmployee(null);
    setEmployeeForm({
      name: '',
      email: '',
      phone: '',
      nik: '',
      address: '',
      date_of_birth: '',
      place_of_birth: '',
      gender: '',
      marital_status: '',
      position: '',
      department: '',
      employment_type: 'permanent',
      join_date: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relation: '',
      // Financial fields
      daily_salary: '',
      hourly_overtime_rate: '',
      loan_balance: '',
      loan_deduction_per_period: '',
      debt_to_company: '',
      bank_name: '',
      bank_account_number: '',
      bank_account_name: ''
    });
  };
  
  const resetFinanceForm = () => {
    setFinanceForm({
      daily_salary: '',
      hourly_overtime_rate: '',
      loan_balance: '',
      loan_deduction_per_period: '',
      debt_to_company: '',
      bank_name: '',
      bank_account_number: '',
      bank_account_name: ''
    });
  };

  const resetPayrollForm = () => {
    setPayrollForm({
      employee_id: '',
      period_start: '',
      period_end: '',
      overtime_hours: '',
      bonus: '',
      allowance: '',
      loan_deduction: '',
      other_deduction: '',
      deduction_note: '',
      notes: ''
    });
    setPayrollCalculation(null);
  };

  const handleLoanSubmit = async (e) => {
    e.preventDefault();

    if (!selectedEmployeeForLoan || !loanForm.nominal || !loanForm.loan_date) {
      toast.error('Nominal dan tanggal pinjam harus diisi');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingLoan 
        ? `/api/v1/employees/loans/${editingLoan.id}`
        : `/api/v1/employees/loans?employee_id=${selectedEmployeeForLoan.id}`;
      
      const method = editingLoan ? 'PUT' : 'POST';
      
      const formData = {
        nominal: parseFloat(loanForm.nominal),
        loan_date: loanForm.loan_date,
        deduction_per_period: loanForm.deduction_per_period ? parseFloat(loanForm.deduction_per_period) : 0,
        notes: loanForm.notes || null
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast.success(editingLoan ? 'Pinjaman berhasil diupdate' : 'Pinjaman berhasil ditambahkan');
        setShowLoanForm(false);
        resetLoanForm();
        await fetchLoans(selectedEmployeeForLoan.id);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Gagal menyimpan pinjaman');
      }
    } catch (error) {
      console.error('Error saving loan:', error);
      toast.error('Terjadi kesalahan saat menyimpan');
    }
  };

  const handleDeleteLoan = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/employees/loans/${deleteLoanId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Pinjaman berhasil dihapus');
        setShowDeleteLoanModal(false);
        await fetchLoans(selectedEmployeeForLoan.id);
      } else {
        toast.error('Gagal menghapus pinjaman');
      }
    } catch (error) {
      console.error('Error deleting loan:', error);
      toast.error('Terjadi kesalahan saat menghapus');
    }
  };

  const openLoanForm = (employee, loan = null) => {
    setSelectedEmployeeForLoan(employee);
    if (loan) {
      setEditingLoan(loan);
      setLoanForm({
        nominal: loan.nominal.toString(),
        loan_date: loan.loan_date,
        deduction_per_period: loan.deduction_per_period?.toString() || '',
        notes: loan.notes || ''
      });
    } else {
      resetLoanForm();
    }
    setShowLoanForm(true);
  };

  const resetLoanForm = () => {
    setEditingLoan(null);
    setLoanForm({
      nominal: '',
      loan_date: '',
      deduction_per_period: '',
      notes: ''
    });
  };

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
  
  // Predefined positions and departments
  const POSITION_OPTIONS = [
    'Operator',
    'Mechanic', 
    'Driver',
    'Supervisor',
    'Manager',
    'Admin',
    'Finance Staff',
    'Helper',
    'Security',
    'Office Boy',
    'Other'
  ];
  
  const DEPARTMENT_OPTIONS = [
    'Operations',
    'Maintenance',
    'Finance',
    'HR',
    'Administration',
    'Management',
    'Security',
    'Logistics',
    'Other'
  ];

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  // Field staff cannot access employee menu
  if (currentUser?.role === 'field' && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle size={64} className="text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
        <p className="text-gray-600">Anda tidak memiliki akses ke menu Karyawan.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manajemen Karyawan</h1>
        <p className="text-gray-600 mt-1 text-sm">Kelola data karyawan, payroll, dan kehadiran</p>
      </div>

      {/* Tabs */}
      <div className="tabs-scrollable bg-gray-100 p-1 rounded-lg mb-4 sm:mb-6">
        <button
          onClick={() => setActiveTab(TABS.EMPLOYEES)}
          className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === TABS.EMPLOYEES
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Briefcase className="inline-block w-4 h-4 mr-1 sm:mr-2" />
          Data Karyawan
        </button>
        {canAccessFinancial && (
          <button
            onClick={() => setActiveTab(TABS.PAYROLL)}
            className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === TABS.PAYROLL
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wallet className="inline-block w-4 h-4 mr-1 sm:mr-2" />
            Payroll
          </button>
        )}
        {canAccessFinancial && (
          <button
            onClick={() => setActiveTab(TABS.LOANS)}
            className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === TABS.LOANS
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CreditCard className="inline-block w-4 h-4 mr-1 sm:mr-2" />
            Pinjaman &amp; Hutang
          </button>
        )}
      </div>

      {/* Employees Tab */}
      {activeTab === TABS.EMPLOYEES && (
        <div>
          {/* Search & Filter */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 sm:mb-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Cari karyawan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Semua Departemen</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              {canManageEmployees && (
                <button
                  onClick={() => {
                    resetEmployeeForm();
                    setShowEmployeeForm(true);
                  }}
                  className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Tambah Karyawan
                </button>
              )}
            </div>
          </div>

          {/* Employees Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
              <thead className="bg-gray-50 whitespace-nowrap">
                <tr>
                  <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase ">Karyawan</th>
                  <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase ">Jabatan</th>
                  <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase ">Departemen</th>
                  <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase ">Status</th>
                  {canAccessFinancial && (
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase ">Gaji/Hari</th>
                  )}
                  <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase ">Pinjaman</th>
                  <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase ">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold mr-3">
                          {employee.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => openEmployeeDetail(employee)}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                          >
                            {employee.name}
                          </button>
                          <p className="text-xs text-gray-500">{employee.employee_code || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 ">{employee.position || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 ">{employee.department || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        employee.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    {canAccessFinancial && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 ">
                        {employee.daily_salary 
                          ? `Rp ${parseFloat(employee.daily_salary).toLocaleString('id-ID')}` 
                          : '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {employee.has_loan ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Ada Pinjaman
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        {canManageEmployees && (
                          <button
                            onClick={() => openEditForm(employee)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Data Karyawan"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        )}
                        {canAccessFinancial && (
                          <button
                            onClick={() => openFinanceModal(employee)}
                            className="text-green-600 hover:text-green-800"
                            title="Data Finansial"
                          >
                            <DollarSign className="w-5 h-5" />
                          </button>
                        )}
                        {isGM && (
                          <button
                            onClick={() => {
                              setDeleteEmployeeId(employee.id);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-600 hover:text-red-800"
                            title="Hapus Karyawan"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            {filteredEmployees.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Tidak ada karyawan yang ditemukan
              </div>
            )}
          </div>

          {showDetailModal && selectedEmployeeDetail && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold">Detail Karyawan</h2>
                      <p className="text-sm text-gray-500">{selectedEmployeeDetail.position || '-'} - {selectedEmployeeDetail.department || '-'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeEmployeeDetail}
                      className="text-gray-500 hover:text-gray-800"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600">Nama</h3>
                        <p className="text-gray-900">{selectedEmployeeDetail.name || '-'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600">Email</h3>
                        <p className="text-gray-900">{selectedEmployeeDetail.email || '-'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600">Telepon</h3>
                        <p className="text-gray-900">{selectedEmployeeDetail.phone || '-'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600">NIK</h3>
                        <p className="text-gray-900">{selectedEmployeeDetail.nik || '-'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600">Alamat</h3>
                        <p className="text-gray-900">{selectedEmployeeDetail.address || '-'}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600">Status</h3>
                        <p className="text-gray-900">{selectedEmployeeDetail.status === 'active' ? 'Aktif' : 'Nonaktif'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600">Tipe Pekerjaan</h3>
                        <p className="text-gray-900">{selectedEmployeeDetail.employment_type || '-'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600">Tanggal Masuk</h3>
                        <p className="text-gray-900">{selectedEmployeeDetail.join_date || '-'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600">Jenis Kelamin</h3>
                        <p className="text-gray-900">{selectedEmployeeDetail.gender || '-'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600">Status Pernikahan</h3>
                        <p className="text-gray-900">{selectedEmployeeDetail.marital_status || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-600">Kontak Darurat</h3>
                      <p className="text-gray-900">{selectedEmployeeDetail.emergency_contact_name || '-'} ({selectedEmployeeDetail.emergency_contact_relation || '-'})</p>
                      <p className="text-gray-900">{selectedEmployeeDetail.emergency_contact_phone || '-'}</p>
                    </div>
                    {canAccessFinancial && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-600">Data Finansial</h3>
                        <p className="text-gray-900">Gaji/Hari: {selectedEmployeeDetail.daily_salary ? `Rp ${parseFloat(selectedEmployeeDetail.daily_salary).toLocaleString('id-ID')}` : '-'}</p>
                        <p className="text-gray-900">Saldo Pinjaman: {selectedEmployeeDetail.loan_balance ? `Rp ${parseFloat(selectedEmployeeDetail.loan_balance).toLocaleString('id-ID')}` : '-'}</p>
                        <p className="text-gray-900">Bank: {selectedEmployeeDetail.bank_name || '-'}</p>
                        <p className="text-gray-900">No. Rekening: {selectedEmployeeDetail.bank_account_number || '-'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payroll Tab */}
      {activeTab === TABS.PAYROLL && canAccessFinancial && (
        <div>
          {/* Payroll Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Total Payroll Bulan Ini</p>
              <p className="text-2xl font-bold text-gray-900">-</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-600">-</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Total Pinjaman</p>
              <p className="text-2xl font-bold text-red-600">-</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Total Hutang</p>
              <p className="text-2xl font-bold text-purple-600">-</p>
            </div>
          </div>

          {/* Create Payroll Button */}
          <div className="mb-4">
            <button
              onClick={() => setShowPayrollForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Buat Payroll
            </button>
          </div>

          {/* Payroll Records Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Periode</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Hari Kerja</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Gaji Pokok</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Potongan</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Gaji Bersih</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payrollRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.period_start} - {record.period_end}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.employee_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.present_days}/{record.work_days} hari
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        Rp {parseFloat(record.basic_salary).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        Rp {parseFloat(record.total_deduction).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        Rp {parseFloat(record.net_salary).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          record.payment_status === 'approved' 
                            ? 'bg-green-100 text-green-800'
                            : record.payment_status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {record.payment_status === 'approved' ? 'Approved' : 
                           record.payment_status === 'pending' ? 'Pending' : record.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {payrollRecords.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Belum ada record payroll
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loans Tab */}
      {activeTab === TABS.LOANS && canAccessFinancial && (
        <div>
          {/* Add Loan Button */}
          <div className="mb-4 flex gap-4">
            <select
              value={selectedEmployeeForLoan?.id || ''}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  setSelectedEmployeeForLoan(null);
                  fetchLoans();
                } else {
                  const emp = employees.find(e => e.id === parseInt(value));
                  if (emp) {
                    setSelectedEmployeeForLoan(emp);
                    fetchLoans(emp.id);
                  }
                }
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Karyawan</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} - {emp.position}</option>
              ))}
            </select>
            <button
              onClick={() => openLoanForm(selectedEmployeeForLoan)}
              disabled={!selectedEmployeeForLoan}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Tambah Pinjaman
            </button>
          </div>

          {/* Loans Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Tanggal Pinjam</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Nominal</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Sisa Saldo</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Potongan/Periode</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employees.find(e => e.id === loan.employee_id)?.name || `ID ${loan.employee_id}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{loan.loan_date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rp {parseFloat(loan.nominal).toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rp {parseFloat(loan.remaining_balance).toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{loan.deduction_per_period ? `Rp ${parseFloat(loan.deduction_per_period).toLocaleString('id-ID')}` : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          loan.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {loan.is_active ? 'Aktif' : 'Selesai'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openLoanForm(selectedEmployeeForLoan, loan)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Pinjaman"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteLoanId(loan.id);
                              setShowDeleteLoanModal(true);
                            }}
                            className="text-red-600 hover:text-red-800"
                            title="Hapus Pinjaman"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {loans.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {selectedEmployeeForLoan ? 'Tidak ada data pinjaman untuk karyawan ini' : 'Pilih karyawan untuk melihat riwayat pinjaman'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Employee Form Modal */}
      {showEmployeeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingEmployee ? 'Edit Karyawan' : 'Tambah Karyawan'}
              </h2>
            </div>
            <form onSubmit={handleEmployeeSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 border-b pb-2">Data Pribadi</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                    <input
                      type="text"
                      required
                      value={employeeForm.name}
                      onChange={(e) => setEmployeeForm({...employeeForm, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={employeeForm.email}
                      onChange={(e) => setEmployeeForm({...employeeForm, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                    <input
                      type="text"
                      value={employeeForm.phone}
                      onChange={(e) => setEmployeeForm({...employeeForm, phone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NIK</label>
                    <input
                      type="text"
                      value={employeeForm.nik}
                      onChange={(e) => setEmployeeForm({...employeeForm, nik: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Employment Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 border-b pb-2">Data Pekerjaan</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jabatan</label>
                    <select
                      value={employeeForm.position}
                      onChange={(e) => setEmployeeForm({...employeeForm, position: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Pilih Jabatan</option>
                      {POSITION_OPTIONS.map(pos => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Departemen</label>
                    <select
                      value={employeeForm.department}
                      onChange={(e) => setEmployeeForm({...employeeForm, department: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Pilih Departemen</option>
                      {DEPARTMENT_OPTIONS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Pekerjaan</label>
                    <select
                      value={employeeForm.employment_type}
                      onChange={(e) => setEmployeeForm({...employeeForm, employment_type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="permanent">Tetap</option>
                      <option value="contract">Kontrak</option>
                      <option value="freelance">Freelance</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Masuk</label>
                    <input
                      type="date"
                      value={employeeForm.join_date}
                      onChange={(e) => setEmployeeForm({...employeeForm, join_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="font-semibold text-gray-700 border-b pb-2">Kontak Darurat</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                      <input
                        type="text"
                        value={employeeForm.emergency_contact_name}
                        onChange={(e) => setEmployeeForm({...employeeForm, emergency_contact_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                      <input
                        type="text"
                        value={employeeForm.emergency_contact_phone}
                        onChange={(e) => setEmployeeForm({...employeeForm, emergency_contact_phone: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hubungan</label>
                      <input
                        type="text"
                        value={employeeForm.emergency_contact_relation}
                        onChange={(e) => setEmployeeForm({...employeeForm, emergency_contact_relation: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Financial Data - Only show if Finance/GM or editing */}
                {(canAccessFinancial || editingEmployee) && (
                  <>
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-700 border-b pb-2">Data Gaji</h3>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gaji per Hari (Rp)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={employeeForm.daily_salary}
                          onChange={(e) => setEmployeeForm({...employeeForm, daily_salary: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="0"
                          disabled={!canAccessFinancial}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rate Lembur per Jam (Rp)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={employeeForm.hourly_overtime_rate}
                          onChange={(e) => setEmployeeForm({...employeeForm, hourly_overtime_rate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="0"
                          disabled={!canAccessFinancial}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-700 border-b pb-2">Pinjaman & Hutang</h3>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sisa Pinjaman (Rp)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={employeeForm.loan_balance}
                          onChange={(e) => setEmployeeForm({...employeeForm, loan_balance: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                          placeholder="0"
                          disabled={true}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Potongan per Periode (Rp)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={employeeForm.loan_deduction_per_period}
                          onChange={(e) => setEmployeeForm({...employeeForm, loan_deduction_per_period: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                          placeholder="0"
                          disabled={true}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hutang ke Perusahaan (Rp)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={employeeForm.debt_to_company}
                          onChange={(e) => setEmployeeForm({...employeeForm, debt_to_company: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                          placeholder="0"
                          disabled={true}
                        />
                      </div>
                    </div>

                    <div className="space-y-4 md:col-span-2">
                      <h3 className="font-semibold text-gray-700 border-b pb-2">Informasi Bank</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
                          <input
                            type="text"
                            value={employeeForm.bank_name}
                            onChange={(e) => setEmployeeForm({...employeeForm, bank_name: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="Contoh: BCA, Mandiri, BRI"
                            disabled={!canAccessFinancial}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Rekening</label>
                          <input
                            type="text"
                            value={employeeForm.bank_account_number}
                            onChange={(e) => setEmployeeForm({...employeeForm, bank_account_number: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="Nomor rekening"
                            disabled={!canAccessFinancial}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Atas Nama</label>
                          <input
                            type="text"
                            value={employeeForm.bank_account_name}
                            onChange={(e) => setEmployeeForm({...employeeForm, bank_account_name: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="Nama pemilik rekening"
                            disabled={!canAccessFinancial}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEmployeeForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingEmployee ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payroll Form Modal */}
      {showPayrollForm && canAccessFinancial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Buat Payroll</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Karyawan *</label>
                  <select
                    required
                    value={payrollForm.employee_id}
                    onChange={(e) => {
                      const empId = e.target.value;
                      const emp = employees.find(employee => employee.id === parseInt(empId));
                      let defaultDeduction = '';
                      if (emp && emp.loan_balance > 0) {
                        const deduction = Math.min(emp.loan_deduction_per_period || 0, emp.loan_balance);
                        if (deduction > 0) {
                          defaultDeduction = deduction;
                        }
                      }
                      setPayrollForm({
                        ...payrollForm, 
                        employee_id: empId,
                        loan_deduction: defaultDeduction
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Pilih Karyawan</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} - {emp.position}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Periode Mulai *</label>
                    <input
                      type="date"
                      required
                      value={payrollForm.period_start}
                      onChange={(e) => setPayrollForm({...payrollForm, period_start: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Periode Selesai *</label>
                    <input
                      type="date"
                      required
                      value={payrollForm.period_end}
                      onChange={(e) => setPayrollForm({...payrollForm, period_end: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jam Lembur</label>
                    <input
                      type="number"
                      step="0.5"
                      value={payrollForm.overtime_hours}
                      onChange={(e) => setPayrollForm({...payrollForm, overtime_hours: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bonus (Rp)</label>
                    <input
                      type="number"
                      value={payrollForm.bonus}
                      onChange={(e) => setPayrollForm({...payrollForm, bonus: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tunjangan (Rp)</label>
                    <input
                      type="number"
                      value={payrollForm.allowance}
                      onChange={(e) => setPayrollForm({...payrollForm, allowance: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Potongan Pinjaman (Rp)</label>
                    <input
                      type="number"
                      value={payrollForm.loan_deduction}
                      onChange={(e) => setPayrollForm({...payrollForm, loan_deduction: e.target.value})}
                      placeholder="Otomatis jika kosong"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                  <textarea
                    value={payrollForm.notes}
                    onChange={(e) => setPayrollForm({...payrollForm, notes: e.target.value})}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Calculate Button */}
                <button
                  type="button"
                  onClick={handleCalculatePayroll}
                  disabled={!payrollForm.employee_id || !payrollForm.period_start || !payrollForm.period_end}
                  className="w-full py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                >
                  Hitung Payroll
                </button>

                {/* Calculation Result */}
                {payrollCalculation && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold text-gray-700">Hasil Perhitungan:</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Hadir:</span>
                        <span className="ml-2 font-medium">{payrollCalculation.present_days}/{payrollCalculation.work_days} hari</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Gaji Pokok:</span>
                        <span className="ml-2 font-medium">Rp {payrollCalculation.basic_salary.toLocaleString('id-ID')}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Lembur:</span>
                        <span className="ml-2 font-medium">Rp {payrollCalculation.overtime_amount.toLocaleString('id-ID')}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Potongan:</span>
                        <span className="ml-2 font-medium text-red-600">Rp {payrollCalculation.total_deduction.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t">
                        <span className="text-gray-700 font-semibold">Gaji Bersih:</span>
                        <span className="ml-2 font-bold text-green-600 text-lg">
                          Rp {payrollCalculation.net_salary.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowPayrollForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCreatePayroll}
                  disabled={!payrollCalculation}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Simpan Payroll
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finance Data Modal */}
      {showFinanceModal && canAccessFinancial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                Data Finansial - {selectedEmployeeForFinance?.name}
              </h2>
              <p className="text-sm text-gray-500">{selectedEmployeeForFinance?.position} - {selectedEmployeeForFinance?.department}</p>
            </div>
            <form onSubmit={handleFinanceSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Payroll Data */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 border-b pb-2">Data Gaji</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gaji per Hari (Rp)</label>
                    <input
                      type="number"
                      value={financeForm.daily_salary}
                      onChange={(e) => setFinanceForm({...financeForm, daily_salary: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="0"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate Lembur per Jam (Rp)</label>
                    <input
                      type="number"
                      value={financeForm.hourly_overtime_rate}
                      onChange={(e) => setFinanceForm({...financeForm, hourly_overtime_rate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Loan & Debt */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 border-b pb-2">Pinjaman & Hutang</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sisa Pinjaman (Rp)</label>
                    <input
                      type="number"
                      value={financeForm.loan_balance}
                      onChange={(e) => setFinanceForm({...financeForm, loan_balance: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      placeholder="0"
                      disabled={true}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Potongan per Periode (Rp)</label>
                    <input
                      type="number"
                      value={financeForm.loan_deduction_per_period}
                      onChange={(e) => setFinanceForm({...financeForm, loan_deduction_per_period: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      placeholder="0"
                      disabled={true}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hutang ke Perusahaan (Rp)</label>
                    <input
                      type="number"
                      value={financeForm.debt_to_company}
                      onChange={(e) => setFinanceForm({...financeForm, debt_to_company: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      placeholder="0"
                      disabled={true}
                    />
                  </div>
                </div>

                {/* Bank Info */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="font-semibold text-gray-700 border-b pb-2">Informasi Bank</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
                      <input
                        type="text"
                        value={financeForm.bank_name}
                        onChange={(e) => setFinanceForm({...financeForm, bank_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Contoh: BCA, Mandiri, BRI"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Rekening</label>
                      <input
                        type="text"
                        value={financeForm.bank_account_number}
                        onChange={(e) => setFinanceForm({...financeForm, bank_account_number: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Nomor rekening"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Atas Nama</label>
                      <input
                        type="text"
                        value={financeForm.bank_account_name}
                        onChange={(e) => setFinanceForm({...financeForm, bank_account_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Nama pemilik rekening"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowFinanceModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Simpan Data Finansial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loan Form Modal */}
      {showLoanForm && selectedEmployeeForLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingLoan ? 'Edit Pinjaman' : 'Tambah Pinjaman'}
              </h2>
              <p className="text-sm text-gray-500">{selectedEmployeeForLoan.name} - {selectedEmployeeForLoan.position}</p>
            </div>
            <form onSubmit={handleLoanSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nominal Pinjaman (Rp) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={loanForm.nominal}
                    onChange={(e) => setLoanForm({...loanForm, nominal: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Masukkan nominal pinjaman"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pinjam *</label>
                  <input
                    type="date"
                    required
                    value={loanForm.loan_date}
                    onChange={(e) => setLoanForm({...loanForm, loan_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Potongan per Periode (Rp)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={loanForm.deduction_per_period}
                    onChange={(e) => setLoanForm({...loanForm, deduction_per_period: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Optional - Masukkan jumlah potongan per periode"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                  <textarea
                    value={loanForm.notes}
                    onChange={(e) => setLoanForm({...loanForm, notes: e.target.value})}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Catatan atau alasan pinjaman"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowLoanForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingLoan ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteEmployee}
        title="Hapus Karyawan"
        message="Apakah Anda yakin ingin menghapus karyawan ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        type="danger"
      />

      {/* Delete Loan Confirmation Modal */}
      <AlertModal
        isOpen={showDeleteLoanModal}
        onClose={() => setShowDeleteLoanModal(false)}
        onConfirm={handleDeleteLoan}
        title="Hapus Pinjaman"
        message="Apakah Anda yakin ingin menghapus data pinjaman ini?"
        confirmText="Hapus"
        cancelText="Batal"
        type="danger"
      />
    </div>
  );
};

export default EmployeesPage;