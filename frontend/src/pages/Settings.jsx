import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import useAuthStore from '../store/authStore';
import { User, Settings as SettingsIcon, UserPlus, Save, AlertCircle } from 'lucide-react';

const Settings = () => {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile stats
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    photo: user?.photo || '',
    password: '',
  });

  const [preview, setPreview] = useState(user?.photo || '');

  // Handle File Upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        setProfileData({ ...profileData, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    password: '',
    role: 'employee'
  });

  const [message, setMessage] = useState({ content: '', type: '' });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put(`/api/users/profile`, profileData);
      // Update local store
      const userInfo = JSON.parse(localStorage.getItem('userInfo'));
      const updatedInfo = { ...userInfo, name: data.name, photo: data.photo, username: data.username };
      localStorage.setItem('userInfo', JSON.stringify(updatedInfo));
      setMessage({ content: 'تم تحديث البيانات بنجاح', type: 'success' });
      // setUser(updatedInfo); // Uncomment if setUser is properly implemented in store
      setTimeout(() => window.location.reload(), 1500); 
    } catch (error) {
      setMessage({ content: error.response?.data?.message || 'فشل التحديث', type: 'error' });
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/users', newUser);
      setNewUser({ name: '', username: '', password: '', role: 'employee' });
      setMessage({ content: 'تم إضافة المستخدم بنجاح', type: 'success' });
    } catch (error) {
      setMessage({ content: error.response?.data?.message || 'فشل إضافة المستخدم', type: 'error' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center">
          <SettingsIcon className="w-7 h-7 ml-2 text-primary-600" />
          الإعدادات
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-4 text-sm font-bold flex items-center whitespace-nowrap ${activeTab === 'profile' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <User className="w-4 h-4 ml-2" />
            الملف الشخصي والحساب
          </button>
          
          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-4 text-sm font-bold flex items-center whitespace-nowrap ${activeTab === 'users' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserPlus className="w-4 h-4 ml-2" />
              إدارة المستخدمين
            </button>
          )}
        </div>

        <div className="p-6">
          {message.content && (
            <div className={`mb-6 p-4 rounded-lg flex items-center shadow-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              <AlertCircle className="w-5 h-5 ml-2" />
              {message.content}
            </div>
          )}

          {activeTab === 'profile' ? (
            <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-2xl">
              <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-8 sm:space-x-reverse mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="w-32 h-32 rounded-full bg-white border-4 border-primary-100 shadow-md flex items-center justify-center overflow-hidden relative group">
                  {preview ? (
                    <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-16 h-16 text-primary-200" />
                  )}
                  <label className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-white text-xs font-bold">تغيير الصورة</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-lg font-bold text-slate-800">الصورة الشخصية</h3>
                  <p className="text-xs text-slate-500">انقر على الدائرة لتحميل صورة من جهازك. يفضل أن تكون مربعة وبحجم أقل من 1 ميجابايت.</p>
                  <label className="inline-block px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm">
                    اختر ملف
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الاسم بالكامل</label>
                  <input
                    type="text"
                    required
                    value={profileData.name}
                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-primary-500 focus:border-primary-500 border bg-white shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">اسم المستخدم (Login ID)</label>
                  <input
                    type="text"
                    required
                    value={profileData.username}
                    onChange={(e) => setProfileData({...profileData, username: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-primary-500 focus:border-primary-500 border bg-white shadow-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">كلمة مرور جديدة (اختياري)</label>
                  <input
                    type="password"
                    value={profileData.password}
                    onChange={(e) => setProfileData({...profileData, password: e.target.value})}
                    placeholder="اتركها فارغة للمحافظة على الحالية"
                    className="block w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-primary-500 focus:border-primary-500 border bg-white shadow-sm"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <button
                  type="submit"
                  className="w-full sm:w-auto flex items-center justify-center px-10 py-3 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all transform hover:-translate-y-0.5"
                >
                  <Save className="w-5 h-5 ml-2" />
                  حفظ كافة التغييرات
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-8">
              <form onSubmit={handleCreateUser} className="space-y-4 max-w-md bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">إضافة موظف جديد</h3>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الاسم</label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500 border bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">اسم المستخدم</label>
                  <input
                    type="text"
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500 border bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500 border bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الصلاحية (الدور)</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500 border bg-white"
                  >
                    <option value="employee">موظف (Employee)</option>
                    <option value="admin">مدير (Admin)</option>
                  </select>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 transition-all hover:shadow-lg"
                  >
                    <UserPlus className="w-5 h-5 ml-2" />
                    إضافة المستخدم للانظام
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
