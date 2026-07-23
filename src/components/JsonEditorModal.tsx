import React, { useState } from 'react';
import { UserPlan } from '../types';

interface JsonEditorModalProps {
  userPlan: UserPlan;
  onSave: (newPlan: UserPlan) => Promise<void>;
  onClose: () => void;
}

export function JsonEditorModal({ userPlan, onSave, onClose }: JsonEditorModalProps) {
  const [jsonText, setJsonText] = useState(() => {
    const cleanPlan = { ...userPlan } as any;
    if (cleanPlan.order) {
      delete cleanPlan.order;
    }
    return JSON.stringify(cleanPlan, null, 2);
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      
      // Basic validation
      if (!parsed || typeof parsed !== 'object' || !parsed.userId) {
        throw new Error("Invalid UserPlan format. Must be an object with a userId.");
      }
      
      const intensities = ['Heavy', 'Light', 'Medium'];
      for (const intensity of intensities) {
        if (!parsed[intensity] || typeof parsed[intensity] !== 'object') {
          throw new Error(`Missing or invalid '${intensity}' day configuration.`);
        }
        for (const [exercise, data] of Object.entries(parsed[intensity])) {
          const typedData = data as any;
          if (typeof typedData.weight !== 'number' || typeof typedData.sets !== 'number' || typeof typedData.reps !== 'string') {
            throw new Error(`Invalid exercise data for ${exercise} on ${intensity} day. Must have weight (number), sets (number), and reps (string).`);
          }
        }
      }

      if (parsed.globalOrder !== undefined && !Array.isArray(parsed.globalOrder)) {
        throw new Error("Invalid 'globalOrder' configuration. Must be an array of strings.");
      }

      if (parsed.order) {
        delete parsed.order;
      }

      setIsSaving(true);
      await onSave(parsed);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Invalid JSON');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-4xl shadow-2xl flex flex-col h-[80vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
            EDIT PLAN JSON
          </h2>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        <textarea 
          value={jsonText}
          onChange={e => setJsonText(e.target.value)}
          className="flex-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-300 font-mono text-sm focus:outline-none focus:border-orange-500 resize-none"
          spellCheck={false}
        />

        <div className="flex justify-end gap-4 mt-6">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-orange-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-orange-600 transition-colors active:scale-95 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save JSON'}
          </button>
        </div>
      </div>
    </div>
  );
}
