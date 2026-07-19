import React, { useState } from 'react';
import { UserPlan, Intensity, PlannedSet } from '../types';
import { Plus, Trash2, ArrowUp, ArrowDown, Download, FileJson } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PlanEditorProps {
  userPlan: UserPlan;
  onSave: (newPlan: UserPlan) => Promise<void>;
  onRawEdit?: () => void;
}

export const PlanEditor: React.FC<PlanEditorProps> = ({ userPlan, onSave, onRawEdit }) => {
  const [editedPlan, setEditedPlan] = useState<UserPlan>(userPlan);
  const [newExercise, setNewExercise] = useState('');
  const [error, setError] = useState('');

  const [exercises, setExercises] = useState<string[]>(() => {
    const exSet = new Set<string>();
    (['Heavy', 'Light', 'Medium'] as Intensity[]).forEach(int => {
      const order = userPlan.order?.[int] || Object.keys(userPlan[int]);
      order.forEach(ex => exSet.add(ex));
    });
    return Array.from(exSet);
  });

  const toggleExercise = (exercise: string, intensity: Intensity) => {
    const newPlan = { ...editedPlan };
    const dayPlan = { ...newPlan[intensity] };
    
    if (dayPlan[exercise]) {
      delete dayPlan[exercise];
    } else {
      const defaultData = 
        newPlan.Heavy[exercise] || 
        newPlan.Light[exercise] || 
        newPlan.Medium[exercise] || 
        { weight: 50, sets: 3, reps: '8' };
        
      dayPlan[exercise] = { ...defaultData };
    }
    
    newPlan[intensity] = dayPlan;
    setEditedPlan(newPlan);
  };

  const updateTarget = (exercise: string, intensity: Intensity, field: keyof PlannedSet, value: string | number) => {
    setEditedPlan(prev => ({
      ...prev,
      [intensity]: {
        ...prev[intensity],
        [exercise]: {
          ...prev[intensity][exercise],
          [field]: field === 'reps' ? String(value) : Number(value)
        }
      }
    }));
  };

  const updateMetadata = (exercise: string, field: 'muscleGroup' | 'pushPull', value: string) => {
    setEditedPlan(prev => ({
      ...prev,
      exerciseMetadata: {
        ...(prev.exerciseMetadata || {}),
        [exercise]: {
          ...(prev.exerciseMetadata?.[exercise] || {}),
          [field]: value || undefined
        }
      }
    }));
  };

  const removeGlobalExercise = (exercise: string) => {
    const newPlan = { ...editedPlan };
    (['Heavy', 'Light', 'Medium'] as Intensity[]).forEach(int => {
       const dayPlan = { ...newPlan[int] };
       delete dayPlan[exercise];
       newPlan[int] = dayPlan;
    });
    setEditedPlan(newPlan);
    setExercises(exercises.filter(e => e !== exercise));
  };

  const moveExercise = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= exercises.length) return;
    const newExercises = [...exercises];
    const temp = newExercises[index];
    newExercises[index] = newExercises[index + direction];
    newExercises[index + direction] = temp;
    setExercises(newExercises);
  };

  const handleAddExercise = () => {
    const normalized = newExercise.trim();
    if (!normalized) return;
    
    if (exercises.includes(normalized)) {
      setError('Exercise already exists');
      return;
    }
    
    setExercises([...exercises, normalized]);
    setNewExercise('');
    setError('');
  };

  const handleSave = () => {
    const finalPlan = { ...editedPlan };
    finalPlan.order = {
      Heavy: exercises.filter(ex => !!finalPlan.Heavy[ex]),
      Light: exercises.filter(ex => !!finalPlan.Light[ex]),
      Medium: exercises.filter(ex => !!finalPlan.Medium[ex]),
    };
    onSave(finalPlan);
  };

  const generatePDF = () => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('HLM Strength Training Plan', 14, 22);

    doc.setFontSize(14);
    doc.text('Exercise Plan', 14, 32);

    const planRows = exercises.map(ex => {
      const formatCell = (day: PlannedSet | undefined) => {
        if (!day) return '-';
        return `${day.sets}x${day.reps} @ ${day.weight}lbs`;
      };
      
      const meta = editedPlan.exerciseMetadata?.[ex];
      const metadataStr = meta?.pushPull || meta?.muscleGroup ? `\n[${meta.pushPull || ''} ${meta.muscleGroup || ''}]`.trim() : '';

      return [
        ex + (metadataStr ? '\n' + metadataStr : ''),
        formatCell(editedPlan.Heavy[ex]),
        formatCell(editedPlan.Light[ex]),
        formatCell(editedPlan.Medium[ex])
      ];
    });

    autoTable(doc, {
      startY: 38,
      head: [['Exercise', 'Day 1 (Heavy)', 'Day 2 (Light)', 'Day 3 (Medium)']],
      body: planRows,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40] },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: 'bold' } }
    });

    // Volume totals
    const getVol = (set: PlannedSet | undefined) => {
      if (!set) return 0;
      const reps = parseInt(set.reps) || 0;
      return set.sets * reps * set.weight;
    };

    const volumeData = Object.keys(editedPlan.exerciseMetadata || {}).reduce((acc, exercise) => {
      const meta = editedPlan.exerciseMetadata![exercise];
      if (meta.muscleGroup && meta.pushPull) {
        const key = `${meta.pushPull}-${meta.muscleGroup}`;
        if (!acc[key]) {
          acc[key] = {
            pushPull: meta.pushPull,
            muscleGroup: meta.muscleGroup,
            heavy: 0,
            light: 0,
            medium: 0,
            heavyVol: 0,
            lightVol: 0,
            mediumVol: 0,
          };
        }
        
        acc[key].heavy += editedPlan.Heavy[exercise]?.sets || 0;
        acc[key].light += editedPlan.Light[exercise]?.sets || 0;
        acc[key].medium += editedPlan.Medium[exercise]?.sets || 0;

        acc[key].heavyVol += getVol(editedPlan.Heavy[exercise]);
        acc[key].lightVol += getVol(editedPlan.Light[exercise]);
        acc[key].mediumVol += getVol(editedPlan.Medium[exercise]);
      }
      return acc;
    }, {} as Record<string, { pushPull: string, muscleGroup: string, heavy: number, light: number, medium: number, heavyVol: number, lightVol: number, mediumVol: number }>);
    
    const sortedData = Object.values(volumeData)
      .sort((a, b) => {
        if (a.pushPull !== b.pushPull) return b.pushPull.localeCompare(a.pushPull);
        return a.muscleGroup.localeCompare(b.muscleGroup);
      })
      .map(d => ({ 
        ...d, 
        total: d.heavy + d.light + d.medium,
        totalVol: d.heavyVol + d.lightVol + d.mediumVol 
      }));

    if (sortedData.length > 0) {
      const totals = sortedData.reduce((acc, row) => {
        acc.heavy += row.heavy;
        acc.light += row.light;
        acc.medium += row.medium;
        acc.total += row.total;
        acc.heavyVol += row.heavyVol;
        acc.lightVol += row.lightVol;
        acc.mediumVol += row.mediumVol;
        acc.totalVol += row.totalVol;
        return acc;
      }, { heavy: 0, light: 0, medium: 0, total: 0, heavyVol: 0, lightVol: 0, mediumVol: 0, totalVol: 0 });

      const formatCellWithVol = (sets: number, vol: number) => {
        if (sets === 0) return '0';
        return `${sets} sets${vol > 0 ? `\n(${vol.toLocaleString()} lbs)` : ''}`;
      };

      const volumeRows = sortedData.map(row => [
        row.pushPull,
        row.muscleGroup,
        formatCellWithVol(row.heavy, row.heavyVol),
        formatCellWithVol(row.light, row.lightVol),
        formatCellWithVol(row.medium, row.mediumVol),
        formatCellWithVol(row.total, row.totalVol)
      ]);

      volumeRows.push([
        'DAILY TOTALS',
        '',
        formatCellWithVol(totals.heavy, totals.heavyVol),
        formatCellWithVol(totals.light, totals.lightVol),
        formatCellWithVol(totals.medium, totals.mediumVol),
        formatCellWithVol(totals.total, totals.totalVol)
      ]);

      let finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(14);
      doc.text('Weekly Set Volume by Push/Pull & Muscle Group', 14, finalY + 14);

      autoTable(doc, {
        startY: finalY + 20,
        head: [['Push or Pull', 'Muscle Group', 'Day 1 (Heavy)', 'Day 2 (Light)', 'Day 3 (Medium)', 'Total Weekly Sets']],
        body: volumeRows,
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40] },
        styles: { fontSize: 10, cellPadding: 4 },
        willDrawCell: (data) => {
          if (data.row.index === volumeRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
        }
      });
    }

    doc.save('hlm-strength-plan.pdf');
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl max-w-[1200px] mx-auto overflow-x-auto">
      <div className="flex justify-between items-center mb-6 min-w-[800px]">
        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
          <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
          PLAN EDITOR
        </h2>
        <div className="flex gap-3">
          {onRawEdit && (
            <button
              onClick={onRawEdit}
              className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-white text-sm font-black uppercase tracking-widest rounded-xl hover:bg-zinc-800 transition-colors active:scale-95 flex items-center gap-2"
            >
              <FileJson className="w-4 h-4" />
              Raw JSON
            </button>
          )}
          <button 
            onClick={generatePDF}
            className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-white text-sm font-black uppercase tracking-widest rounded-xl hover:bg-zinc-800 transition-colors active:scale-95 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 bg-white text-black text-sm font-black uppercase tracking-widest rounded-xl hover:bg-blue-500 hover:text-white transition-colors active:scale-95"
          >
            Save Plan
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-6">
          {error}
        </div>
      )}

      <div className="min-w-[800px] border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/30">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-800 text-xs font-black uppercase tracking-widest text-zinc-500">
              <th className="p-4 w-1/4">Exercise</th>
              <th className="p-4 w-1/5">Heavy Day</th>
              <th className="p-4 w-1/5">Light Day</th>
              <th className="p-4 w-1/5">Medium Day</th>
              <th className="p-4 w-[120px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((exercise, idx) => (
              <tr key={exercise} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
                <td className="p-4 font-bold text-white text-sm align-top">
                  <div className="mb-3">{exercise}</div>
                  <div className="flex flex-col gap-2 max-w-[150px]">
                    <select
                      value={editedPlan.exerciseMetadata?.[exercise]?.muscleGroup || ''}
                      onChange={(e) => updateMetadata(exercise, 'muscleGroup', e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-xs text-zinc-400 focus:outline-none focus:border-blue-500 w-full"
                    >
                      <option value="">Muscle Group...</option>
                      <option value="Chest">Chest</option>
                      <option value="Shoulders">Shoulders</option>
                      <option value="Quads">Quads</option>
                      <option value="Back">Back</option>
                      <option value="Biceps">Biceps</option>
                      <option value="Triceps">Triceps</option>
                      <option value="Hamstrings/Glutes">Hamstrings/Glutes</option>
                    </select>
                    <select
                      value={editedPlan.exerciseMetadata?.[exercise]?.pushPull || ''}
                      onChange={(e) => updateMetadata(exercise, 'pushPull', e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-xs text-zinc-400 focus:outline-none focus:border-blue-500 w-full"
                    >
                      <option value="">Push/Pull...</option>
                      <option value="Push">Push</option>
                      <option value="Pull">Pull</option>
                    </select>
                  </div>
                </td>
                {(['Heavy', 'Light', 'Medium'] as Intensity[]).map(intensity => {
                  const isActive = !!editedPlan[intensity][exercise];
                  const target = editedPlan[intensity][exercise];
                  
                  return (
                    <td key={intensity} className="p-4 align-top">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-400 mb-3 hover:text-zinc-200 transition-colors w-fit">
                        <input 
                          type="checkbox" 
                          checked={isActive} 
                          onChange={() => toggleExercise(exercise, intensity)}
                          className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900"
                        />
                        {isActive ? 'ENABLED' : 'DISABLED'}
                      </label>
                      
                      {isActive && target && (
                        <div className="flex gap-1.5 items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 w-max">
                          <input 
                            type="number" 
                            title="Sets"
                            value={target.sets} 
                            onChange={e => updateTarget(exercise, intensity, 'sets', e.target.value)}
                            className="w-10 bg-transparent border-none p-1 text-center text-sm font-mono text-white focus:outline-none focus:bg-zinc-800 rounded"
                          />
                          <span className="text-zinc-600 font-mono text-xs">x</span>
                          <input 
                            type="text" 
                            title="Reps"
                            value={target.reps} 
                            onChange={e => updateTarget(exercise, intensity, 'reps', e.target.value)}
                            className="w-10 bg-transparent border-none p-1 text-center text-sm font-mono text-white focus:outline-none focus:bg-zinc-800 rounded"
                          />
                          <span className="text-zinc-600 font-mono text-xs">@</span>
                          <input 
                            type="number" 
                            title="Weight (lbs)"
                            value={target.weight} 
                            onChange={e => updateTarget(exercise, intensity, 'weight', e.target.value)}
                            className="w-14 bg-transparent border-none p-1 text-center text-sm font-mono text-white focus:outline-none focus:bg-zinc-800 rounded"
                          />
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="p-4 align-middle">
                  <div className="flex items-center justify-end gap-1">
                    <button 
                      onClick={() => moveExercise(idx, -1)} 
                      disabled={idx === 0}
                      className="p-1.5 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 rounded-md hover:bg-zinc-800 transition-colors"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => moveExercise(idx, 1)} 
                      disabled={idx === exercises.length - 1}
                      className="p-1.5 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 rounded-md hover:bg-zinc-800 transition-colors"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => removeGlobalExercise(exercise)}
                      className="p-1.5 text-zinc-500 hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors ml-2"
                      title="Remove Exercise entirely"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex gap-3">
          <input 
            type="text" 
            value={newExercise}
            onChange={(e) => setNewExercise(e.target.value)}
            placeholder="Add new exercise..."
            className="flex-1 bg-zinc-950 border border-zinc-800 text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 text-sm font-bold"
            onKeyDown={e => e.key === 'Enter' && handleAddExercise()}
          />
          <button 
            onClick={handleAddExercise} 
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2.5 rounded-xl transition-colors font-bold text-sm flex items-center gap-2 uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" /> Add Row
          </button>
        </div>
      </div>

      <div className="mt-8 border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/30">
        <div className="bg-zinc-900 border-b border-zinc-800 p-4">
          <h3 className="text-lg font-black text-white tracking-tight">Weekly Set Volume by Push/Pull & Muscle Group</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-900/50 border-b border-zinc-800 text-xs font-black uppercase tracking-widest text-zinc-500">
              <th className="p-3 w-[15%]">Push or Pull</th>
              <th className="p-3 w-[25%]">Muscle Group</th>
              <th className="p-3 w-[15%]">Day 1 (Heavy)</th>
              <th className="p-3 w-[15%]">Day 2 (Light)</th>
              <th className="p-3 w-[15%]">Day 3 (Medium)</th>
              <th className="p-3 w-[15%]">Total Weekly Sets</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const getVol = (set: PlannedSet | undefined) => {
                if (!set) return 0;
                const reps = parseInt(set.reps) || 0;
                return set.sets * reps * set.weight;
              };

              const volumeData = Object.keys(editedPlan.exerciseMetadata || {}).reduce((acc, exercise) => {
                const meta = editedPlan.exerciseMetadata![exercise];
                if (meta.muscleGroup && meta.pushPull) {
                  const key = `${meta.pushPull}-${meta.muscleGroup}`;
                  if (!acc[key]) {
                    acc[key] = {
                      pushPull: meta.pushPull,
                      muscleGroup: meta.muscleGroup,
                      heavy: 0,
                      light: 0,
                      medium: 0,
                      heavyVol: 0,
                      lightVol: 0,
                      mediumVol: 0,
                    };
                  }
                  
                  acc[key].heavy += editedPlan.Heavy[exercise]?.sets || 0;
                  acc[key].light += editedPlan.Light[exercise]?.sets || 0;
                  acc[key].medium += editedPlan.Medium[exercise]?.sets || 0;

                  acc[key].heavyVol += getVol(editedPlan.Heavy[exercise]);
                  acc[key].lightVol += getVol(editedPlan.Light[exercise]);
                  acc[key].mediumVol += getVol(editedPlan.Medium[exercise]);
                }
                return acc;
              }, {} as Record<string, { pushPull: string, muscleGroup: string, heavy: number, light: number, medium: number, heavyVol: number, lightVol: number, mediumVol: number }>);
              
              const sortedData = Object.values(volumeData)
                .sort((a, b) => {
                  if (a.pushPull !== b.pushPull) return b.pushPull.localeCompare(a.pushPull);
                  return a.muscleGroup.localeCompare(b.muscleGroup);
                })
                .map(d => ({ 
                  ...d, 
                  total: d.heavy + d.light + d.medium,
                  totalVol: d.heavyVol + d.lightVol + d.mediumVol 
                }));

              if (sortedData.length === 0) {
                return (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest">
                      Assign metadata to exercises to view volume metrics
                    </td>
                  </tr>
                );
              }

              const totals = sortedData.reduce((acc, row) => {
                acc.heavy += row.heavy;
                acc.light += row.light;
                acc.medium += row.medium;
                acc.total += row.total;
                acc.heavyVol += row.heavyVol;
                acc.lightVol += row.lightVol;
                acc.mediumVol += row.mediumVol;
                acc.totalVol += row.totalVol;
                return acc;
              }, { heavy: 0, light: 0, medium: 0, total: 0, heavyVol: 0, lightVol: 0, mediumVol: 0, totalVol: 0 });

              const formatCell = (sets: number, vol: number) => (
                <div className="flex flex-col">
                  <span>{sets} sets</span>
                  {vol > 0 && <span className="text-[10px] text-zinc-500">{vol.toLocaleString()} lbs</span>}
                </div>
              );

              return (
                <>
                  {sortedData.map((row) => (
                    <tr key={`${row.pushPull}-${row.muscleGroup}`} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors text-sm text-zinc-300">
                      <td className="p-3 font-bold">{row.pushPull}</td>
                      <td className="p-3">{row.muscleGroup}</td>
                      <td className="p-3 font-mono">{formatCell(row.heavy, row.heavyVol)}</td>
                      <td className="p-3 font-mono">{formatCell(row.light, row.lightVol)}</td>
                      <td className="p-3 font-mono">{formatCell(row.medium, row.mediumVol)}</td>
                      <td className="p-3 font-mono font-bold text-white">{formatCell(row.total, row.totalVol)}</td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-900/80 text-sm text-white font-black border-t-2 border-zinc-700">
                    <td className="p-3 uppercase tracking-widest text-zinc-400" colSpan={2}>Daily Totals</td>
                    <td className="p-3 font-mono text-orange-500">{formatCell(totals.heavy, totals.heavyVol)}</td>
                    <td className="p-3 font-mono text-blue-500">{formatCell(totals.light, totals.lightVol)}</td>
                    <td className="p-3 font-mono text-yellow-500">{formatCell(totals.medium, totals.mediumVol)}</td>
                    <td className="p-3 font-mono text-white">{formatCell(totals.total, totals.totalVol)}</td>
                  </tr>
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
};
