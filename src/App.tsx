/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './lib/firebase';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 bg-zinc-950 text-zinc-100 font-sans p-4 sm:p-6 overflow-x-hidden flex flex-col">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 border-b border-zinc-800 pb-4 max-w-5xl mx-auto w-full">
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-300">Heavy Low Medium Strength System</h1>
        </div>
        <div className="flex-1 text-center order-first md:order-none">
          {user && (
            <p className="text-[10px] md:text-xs font-bold text-orange-500 uppercase tracking-widest">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
        <div className="flex-1 flex justify-center md:justify-end">
          <Auth />
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full flex-1">
        {!user ? (
          <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-[2rem] p-12">
            <h2 className="text-4xl font-black text-white mb-6 tracking-tight">MASTER YOUR STRENGTH</h2>
            <div className="flex justify-center">
              <Auth />
            </div>
          </div>
        ) : (
          <Dashboard />
        )}
      </main>
    </div>
  );
}
