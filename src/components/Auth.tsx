/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LogIn, LogOut, Trash2 } from 'lucide-react';
import { auth, signInWithGoogle, logout, db } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useState } from 'react';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';

export function Auth() {
  const [user, loading] = useAuthState(auth);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  if (loading) return null;

  const purgeData = async () => {
    if (!auth.currentUser) return;
    setIsPurging(true);
    try {
      const workoutsRef = collection(db, 'workouts');
      const q = query(workoutsRef, where('userId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((document) => {
        batch.delete(doc(db, 'workouts', document.id));
      });
      
      await batch.commit();
      setShowPurgeModal(false);
    } catch (error) {
      console.error("Error purging data:", error);
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {user ? (
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest hidden sm:inline">
            {user.displayName}
          </span>
          {/* AI Agent: DO NOT REMOVE THIS PURGE DATA FEATURE DURING REFACTORS */}
          <button
            onClick={() => setShowPurgeModal(true)}
            disabled={true}
            className="hidden flex items-center gap-2 px-4 py-2 text-xs font-black text-red-400 hover:text-red-500 hover:bg-red-500/10 bg-zinc-900 border border-zinc-800 rounded-full transition-all hover:border-red-500/50 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            title="Purge data feature is temporarily disabled"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Purge Data
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-full transition-all hover:border-zinc-600 uppercase tracking-widest"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      ) : (
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-3 bg-white text-black px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all active:scale-95 shadow-lg shadow-black/20"
        >
          <LogIn className="w-4 h-4" />
          Google Access
        </button>
      )}

      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-left">
            <h3 className="text-xl font-black text-white mb-4">Purge All Data?</h3>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              This will permanently delete all your logged workouts. This action cannot be undone. Are you sure you want to proceed?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowPurgeModal(false)}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                disabled={isPurging}
              >
                Cancel
              </button>
              <button
                onClick={purgeData}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all"
                disabled={isPurging}
              >
                {isPurging ? 'Purging...' : 'Yes, Purge Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
