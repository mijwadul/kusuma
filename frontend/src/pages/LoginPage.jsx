import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader } from 'lucide-react';
import LoginBg from '../components/Assets/Login.png';
import { login } from '../api/auth.js';



export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});



  const validateForm = () => {

    const newErrors = {};



    if (!formData.email) {

      newErrors.email = 'Email harus diisi';

    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {

      newErrors.email = 'Format email tidak valid';

    }



    if (!formData.password) {
      newErrors.password = 'Password harus diisi';
    } else if (formData.password.length < 5) {
      newErrors.password = 'Password minimal 5 karakter';
    }



    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;

  };



  const handleSubmit = async (e) => {

    e.preventDefault();



    if (!validateForm()) return;



    setIsLoading(true);
    console.log('Attempting login with:', formData.email);
    try {
      const result = await login(formData.email, formData.password);
      console.log('Login success:', result);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error full:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      
      let errorMsg = 'Login gagal. Periksa email dan password Anda.';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        errorMsg = typeof detail === 'string' ? detail : JSON.stringify(detail);
      }
      
      setErrors({
        general: errorMsg
      });
    } finally {
      setIsLoading(false);
    }

  };



  const handleInputChange = (e) => {

    const { name, value, type, checked } = e.target;

    setFormData(prev => ({

      ...prev,

      [name]: type === 'checkbox' ? checked : value

    }));



    // Clear error when user starts typing

    if (errors[name]) {

      setErrors(prev => ({ ...prev, [name]: '' }));

    }

  };



  return (

    <div

      className="min-h-screen flex items-center justify-center px-4 py-12 bg-cover bg-center bg-no-repeat"

      style={{ backgroundImage: `url(${LoginBg})` }}

    >

      {/* Login Form Container */}

      <div className="w-full max-w-md flex items-center justify-center">

        <div className="w-full max-w-md">

          {/* Header */}

          <div className="text-center mb-8">

            <div

              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 shadow-lg bg-[#0F172A]"

            >

              <span className="text-2xl font-bold text-white">KS</span>

            </div>

            <h1 className="text-3xl font-bold mb-2 text-white drop-shadow-lg">PT. Kusuma Samudera Group</h1>

            <p className="text-sm text-white/90 drop-shadow-md">Manajemen Sumber Daya Perusahaan</p>

          </div>



          {/* Login Card */}

          <div className="bg-white/20 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/30">

            {/* Card Header */}

            <div

              className="px-8 py-6 bg-white/10"

            >

              <h2 className="text-2xl font-bold text-white">Selamat Datang</h2>

              <p className="text-sm mt-1 text-white/80">Masuk ke sistem manajemen Anda</p>

            </div>



            {/* Card Body */}
            <form onSubmit={handleSubmit} className="px-8 py-8">
              {/* General Error */}
              {errors.general && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-400 rounded-lg text-red-200 text-sm">
                  {errors.general}
                </div>
              )}
              {/* Email Input */}

              <div className="mb-6">

                <label htmlFor="email" className="block text-sm font-semibold mb-3 text-white">

                  Email

                </label>

                <div className="relative">

                  <div className="absolute left-3 top-3.5 text-white/70">

                    <Mail size={20} />

                  </div>

                  <input

                    id="email"

                    name="email"

                    type="email"

                    placeholder="nama@perusahaan.com"

                    value={formData.email}

                    onChange={handleInputChange}

                    className="w-full pl-10 pr-4 py-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-white/80 placeholder-gray-500 focus:ring-[#0D9488]"

                    style={{

                      borderColor: errors.email ? '#EF4444' : '#E8DCC8',

                    }}

                  />

                </div>

                {errors.email && (

                  <p className="text-red-300 text-sm mt-2">{errors.email}</p>

                )}

              </div>



              {/* Password Input */}

              <div className="mb-6">

                <label htmlFor="password" className="block text-sm font-semibold mb-3 text-white">

                  Password

                </label>

                <div className="relative">

                  <div className="absolute left-3 top-3.5 text-white/70">

                    <Lock size={20} />

                  </div>

                  <input

                    id="password"

                    name="password"

                    type={showPassword ? 'text' : 'password'}

                    placeholder="••••••••"

                    value={formData.password}

                    onChange={handleInputChange}

                    className="w-full pl-10 pr-10 py-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-white/80 placeholder-gray-500 focus:ring-[#0D9488]"

                    style={{

                      borderColor: errors.password ? '#EF4444' : '#E8DCC8',

                    }}

                  />

                  <button

                    type="button"

                    onClick={() => setShowPassword(!showPassword)}

                    className="absolute right-3 top-3.5 transition-colors text-white/70 hover:text-white"

                  >

                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}

                  </button>

                </div>

                {errors.password && (

                  <p className="text-red-300 text-sm mt-2">{errors.password}</p>

                )}

              </div>



              {/* Remember Me */}

              <div className="mb-8">

                <label className="flex items-center cursor-pointer">

                  <input

                    type="checkbox"

                    name="rememberMe"

                    checked={formData.rememberMe}

                    onChange={handleInputChange}

                    className="w-4 h-4 rounded focus:ring-2 cursor-pointer focus:ring-[#0D9488]"

                    style={{

                      accentColor: '#0D9488',

                    }}

                  />

                  <span className="ml-2 text-sm text-white">Ingat saya</span>

                </label>

              </div>



              {/* Submit Button */}

              <button

                type="submit"

                disabled={isLoading}

                className="w-full text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center bg-[#0D9488] hover:bg-[#0F766E]"

              >

                {isLoading ? (

                  <>

                    <Loader size={20} className="mr-2 animate-spin" />

                    Memproses...

                  </>

                ) : (

                  'Masuk'

                )}

              </button>

            </form>

          </div>



          {/* Footer Info */}

          <p className="text-center text-sm mt-8 text-white/90 drop-shadow-md">

            © 2026 PT. Kusuma Samudera Group. Semua hak dilindungi.

          </p>

        </div>

      </div>

    </div>

  );

}