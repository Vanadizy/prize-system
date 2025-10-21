// src/pages/Profile.jsx
import React, { useState, useEffect } from 'react';

// NOTE: You must import useAuth from your AuthContext to get real user data and a logout function.
// import { useAuth } from '../context/AuthContext'; 

// Mock user data and mock password change function for demonstration
const MOCK_USER = {
  username: 'loading...',
  email: 'loading...',
  role: 'loading...',
};

// --- MOCK AUTH HOOK ---
const useAuth = () => ({
  user: MOCK_USER,
  loading: false,
  changePassword: async (current, newPass) => {
    return new Promise(resolve => {
      setTimeout(() => {
        if (current !== 'password123') {
          resolve({ success: false, message: 'Incorrect current password.' });
        } else {
          resolve({ success: true, message: 'Password updated successfully!' });
        }
      }, 1500);
    });
  }
});
// -----------------------

const Profile = () => {
  const { user, loading, changePassword } = useAuth();
  
  // State for Change Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Reset form and message when component mounts or user changes
  useEffect(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage({ text: '', type: '' });
  }, [user]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (newPassword !== confirmPassword) {
      setMessage({ text: 'New password and confirmation do not match.', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ text: 'New password must be at least 6 characters long.', type: 'error' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Replace with your actual API call using the changePassword function from context
      const result = await changePassword(currentPassword, newPassword); 

      if (result.success) {
        setMessage({ text: result.message, type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ text: result.message, type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'An unexpected error occurred.', type: 'error' });
    }
    
    setIsSubmitting(false);
  };

  const inputClass = "w-full p-3 border border-indigo-700 rounded-lg bg-indigo-50 focus:border-indigo-500 focus:ring-indigo-500 transition duration-150 text-gray-900";
  const buttonClass = "w-full py-3 px-4 rounded-lg font-semibold transition duration-150";

  if (loading) {
    return <div className="p-8 text-center text-white">Loading profile...</div>;
  }

  return (
    <div className="flex justify-center p-8">
      <div className="w-full max-w-4xl bg-white shadow-2xl rounded-xl overflow-hidden">
        
        {/* Header Section */}
        <div className="bg-indigo-700 p-6 text-white">
            <button
                type="button"
                onClick={() => window.history.back()}
                className="mr-4 inline-flex items-center text-white hover:text-indigo-200 focus:outline-none"
                aria-label="Go Back"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
            </button>
          <h1 className="text-3xl font-bold">User Profile</h1>
          <p className="text-indigo-200 mt-1">Manage your account information and password.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 p-6 lg:p-10">
          
          {/* 1. Profile Information Card */}
          <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
            <h2 className="text-xl font-bold text-indigo-800 mb-4 border-b pb-2">Account Details</h2>
            
            <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center text-3xl text-white font-bold">
                    {user.username ? user.username[0].toUpperCase() : 'U'}
                </div>
                <div>
                    <p className="text-2xl font-bold text-gray-800">{user.username || 'N/A'}</p>
                    <p className="text-sm text-gray-500 capitalize">{user.role || 'Guest'}</p>
                </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm">
                <p className="font-semibold text-gray-600">Role:</p>
                <p className="text-gray-900 capitalize">{user.role || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* 2. Change Password Form Card */}
          <div className="p-6 rounded-lg bg-white border border-gray-200 shadow-lg">
            <h2 className="text-xl font-bold text-indigo-800 mb-6 border-b pb-2">Change Password</h2>

            {message.text && (
              <div 
                className={`p-3 mb-4 rounded-lg text-sm font-medium ${
                  message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  placeholder="********"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder="New Password (min 6 chars)"
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Confirm New Password"
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              <button
                type="submit"
                className={`${buttonClass} bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400`}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;