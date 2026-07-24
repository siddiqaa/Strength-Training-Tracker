import React, { useState, useEffect } from 'react';
import { UserPlan, Intensity, PlannedSet } from '../types';
import { getOrderedExerciseNames, createExerciseOrderItems } from '../lib/workoutUtils';
import { Plus, Trash2, ArrowUp, ArrowDown, Download, MessageSquare, AlertCircle, Save, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PlanEditorProps {
  userPlan: UserPlan;
  onSave: (newPlan: UserPlan) => Promise<void>;
  onDeleteExercise?: (exercise: string) => Promise<void>;
}

export const PlanEditor: React.FC<PlanEditorProps> = ({ userPlan, onSave, onDeleteExercise }) => {
  const [editedPlan, setEditedPlan] = useState<UserPlan>(userPlan);
  const [newExercise, setNewExercise] = useState('');
  const [error, setError] = useState('');

  const [exercises, setExercises] = useState<string[]>(() => {
    const allActive = new Set<string>();
    (['Heavy', 'Light', 'Medium'] as Intensity[]).forEach(int => {
      Object.keys(userPlan[int] || {}).forEach(ex => allActive.add(ex));
    });
    return getOrderedExerciseNames(
      userPlan.exerciseOrder,
      Array.from(allActive)
    );
  });

  useEffect(() => {
    setEditedPlan(userPlan);
    const allActive = new Set<string>();
    (['Heavy', 'Light', 'Medium'] as Intensity[]).forEach(int => {
      Object.keys(userPlan[int] || {}).forEach(ex => allActive.add(ex));
    });
    setExercises(
      getOrderedExerciseNames(
        userPlan.exerciseOrder,
        Array.from(allActive)
      )
    );
  }, [userPlan]);

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

  const updateDayMetadata = (intensity: Intensity, field: 'restPeriod', value: string) => {
    setEditedPlan(prev => ({
      ...prev,
      dayMetadata: {
        ...prev.dayMetadata,
        [intensity]: {
          ...(prev.dayMetadata?.[intensity] || {}),
          [field]: Number(value)
        }
      }
    }));
  };

  const updateMetadata = (exercise: string, field: 'muscleGroup' | 'pushPull' | 'notes', value: string) => {
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

  const removeGlobalExercise = async (exercise: string) => {
    if (!window.confirm(`Are you sure you want to delete "${exercise}"?\n\nThis will remove it from your plan AND permanently delete all workout logs for this exercise.`)) {
      return;
    }

    if (onDeleteExercise) {
      await onDeleteExercise(exercise);
    }

    const newPlan = { ...editedPlan };
    (['Heavy', 'Light', 'Medium'] as Intensity[]).forEach(int => {
       const dayPlan = { ...newPlan[int] };
       delete dayPlan[exercise];
       newPlan[int] = dayPlan;
    });
    
    // Also remove from order structures and metadata
    const remainingExercises = exercises.filter(e => e !== exercise);
    const updatedOrder = createExerciseOrderItems(remainingExercises);
    newPlan.exerciseOrder = updatedOrder;
    if (newPlan.exerciseMetadata?.[exercise]) {
      delete newPlan.exerciseMetadata[exercise];
    }

    setEditedPlan(newPlan);
    setExercises(remainingExercises);
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
    const orderItems = createExerciseOrderItems(exercises);
    finalPlan.exerciseOrder = orderItems;
    delete (finalPlan as any).globalOrder;
    delete (finalPlan as any).order;
    
    // Ensure dayMetadata is populated with defaults before saving
    if (!finalPlan.dayMetadata) {
      finalPlan.dayMetadata = {};
    }
    (['Heavy', 'Light', 'Medium'] as Intensity[]).forEach(int => {
      if (!finalPlan.dayMetadata![int]) {
        finalPlan.dayMetadata![int] = {};
      }
      if (finalPlan.dayMetadata![int]!.restPeriod === undefined) {
        finalPlan.dayMetadata![int]!.restPeriod = 90;
      }
    });

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
        return `${day.sets}x${day.reps} @ ${day.weight}`;
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

    const heavyRest = editedPlan.dayMetadata?.Heavy?.restPeriod ?? 90;
    const lightRest = editedPlan.dayMetadata?.Light?.restPeriod ?? 90;
    const mediumRest = editedPlan.dayMetadata?.Medium?.restPeriod ?? 90;

    autoTable(doc, {
      startY: 38,
      head: [[
        'Exercise', 
        `Day 1 (Heavy)\nRest: ${heavyRest}s`, 
        `Day 2 (Light)\nRest: ${lightRest}s`, 
        `Day 3 (Medium)\nRest: ${mediumRest}s`
      ]],
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
        return `${sets} sets${vol > 0 ? `\n(${vol.toLocaleString()})` : ''}`;
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
    <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6">
        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
          <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
          PLAN EDITOR
        </h2>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <button 
            onClick={generatePDF}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-white text-sm font-black uppercase tracking-widest rounded-xl hover:bg-zinc-800 transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button 
            onClick={handleSave}
            className="w-full sm:w-auto px-6 py-2.5 bg-white text-black text-sm font-black uppercase tracking-widest rounded-xl hover:bg-blue-500 hover:text-white transition-colors active:scale-95"
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

      <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/30">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-zinc-800">
          {exercises.map((exercise, idx) => (
            <div key={exercise} className="p-4 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-3">
                  <div className="text-sm font-black text-white uppercase tracking-wider">{exercise}</div>
                  <div className="flex gap-2">
                    <select
                      value={editedPlan.exerciseMetadata?.[exercise]?.muscleGroup || ''}
                      onChange={(e) => updateMetadata(exercise, 'muscleGroup', e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-400 focus:outline-none focus:border-blue-500 flex-1"
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
                      className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-400 focus:outline-none focus:border-blue-500 flex-1"
                    >
                      <option value="">Push/Pull...</option>
                      <option value="Push">Push</option>
                      <option value="Pull">Pull</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1">
                    <button 
                      onClick={() => moveExercise(idx, -1)} 
                      disabled={idx === 0}
                      className="p-2 text-zinc-500 hover:text-white disabled:opacity-30 bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => moveExercise(idx, 1)} 
                      disabled={idx === exercises.length - 1}
                      className="p-2 text-zinc-500 hover:text-white disabled:opacity-30 bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeGlobalExercise(exercise)}
                    className="p-2 text-zinc-500 hover:text-red-500 bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
                    title="Remove Exercise"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                {(['Heavy', 'Light', 'Medium'] as Intensity[]).map(intensity => {
                  const isActive = !!editedPlan[intensity][exercise];
                  const target = editedPlan[intensity][exercise];
                  return (
                    <div key={intensity} className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          <input 
                            type="checkbox" 
                            checked={isActive} 
                            onChange={() => toggleExercise(exercise, intensity)}
                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-500"
                          />
                          {intensity} Day
                        </label>
                        {!isActive && <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Disabled</span>}
                      </div>
                      
                      {isActive && target && (
                        <div className="flex justify-between items-center">
                          <div className="flex gap-1 items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                            <input 
                              type="number" 
                              value={target.sets} 
                              onChange={e => updateTarget(exercise, intensity, 'sets', e.target.value)}
                              className="w-8 bg-transparent text-center text-xs font-mono text-white focus:outline-none"
                            />
                            <span className="text-zinc-600 font-mono text-[10px]">x</span>
                            <input 
                              type="text" 
                              value={target.reps} 
                              onChange={e => updateTarget(exercise, intensity, 'reps', e.target.value)}
                              className="w-8 bg-transparent text-center text-xs font-mono text-white focus:outline-none"
                            />
                            <span className="text-zinc-600 font-mono text-[10px]">@</span>
                            <input 
                              type="number" 
                              value={target.weight} 
                              onChange={e => updateTarget(exercise, intensity, 'weight', e.target.value)}
                              className="w-12 bg-transparent text-center text-xs font-mono text-white focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-1 text-[10px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
                            <span className="text-zinc-600">Rest:</span>
                            <input 
                              type="number" 
                              value={editedPlan.dayMetadata?.[intensity]?.restPeriod ?? 90}
                              onChange={(e) => updateDayMetadata(intensity, 'restPeriod', e.target.value)}
                              className="w-8 bg-transparent text-white text-center focus:outline-none"
                            />
                            <span className="text-zinc-600">s</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <textarea
                value={editedPlan.exerciseMetadata?.[exercise]?.notes || ''}
                onChange={(e) => updateMetadata(exercise, 'notes', e.target.value)}
                placeholder="Exercise Notes & Performance Cues..."
                className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 w-full min-h-[80px] resize-none"
              />
            </div>
          ))}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-800 text-xs font-black uppercase tracking-widest text-zinc-500">
                <th className="p-4 w-1/4">Exercise</th>
                {(['Heavy', 'Light', 'Medium'] as Intensity[]).map(intensity => (
                  <th key={intensity} className="p-4 w-1/5">
                    <div className="flex flex-col gap-2">
                      <span>{intensity} Day</span>
                      <div className="flex items-center gap-1 text-[10px] bg-zinc-950 border border-zinc-800 rounded px-2 py-1 w-max">
                        <span className="text-zinc-600">Rest:</span>
                        <input 
                          type="number" 
                          value={editedPlan.dayMetadata?.[intensity]?.restPeriod ?? 90}
                          onChange={(e) => updateDayMetadata(intensity, 'restPeriod', e.target.value)}
                          className="w-10 bg-transparent text-white border-none p-0 text-center focus:outline-none"
                        />
                        <span className="text-zinc-600">sec</span>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="p-4 w-[120px] text-right align-top">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((exercise, idx) => (
                <React.Fragment key={exercise}>
                  <tr className="hover:bg-zinc-900/30 transition-colors">
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
                                title="Weight"
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
                  <tr className="border-b border-zinc-800/50 bg-zinc-900/5 hover:bg-zinc-900/20 transition-colors">
                    <td colSpan={5} className="p-4 pt-0">
                      <div className="flex gap-3 items-start">
                        <div className="mt-2 text-zinc-600">
                          <MessageSquare className="w-3 h-3" />
                        </div>
                        <textarea
                          value={editedPlan.exerciseMetadata?.[exercise]?.notes || ''}
                          onChange={(e) => updateMetadata(exercise, 'notes', e.target.value)}
                          placeholder="Add cues, machine settings, or performance notes for this exercise..."
                          className="bg-transparent border-none p-0 text-xs text-zinc-400 placeholder:text-zinc-700 focus:outline-none focus:ring-0 w-full min-h-[40px] resize-none"
                        />
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
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

              const groups: Record<string, typeof sortedData> = sortedData.reduce((acc, row) => {
                if (!acc[row.pushPull]) acc[row.pushPull] = [];
                acc[row.pushPull].push(row);
                return acc;
              }, {} as Record<string, typeof sortedData>);

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
                  {vol > 0 && <span className="text-[10px] text-zinc-500">{vol.toLocaleString()}</span>}
                </div>
              );

              return (
                <>
                  {Object.entries(groups).map(([groupName, rows]) => {
                    const subtotal = rows.reduce((acc, row) => {
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

                    return (
                      <React.Fragment key={groupName}>
                        {rows.map((row) => (
                          <tr key={`${row.pushPull}-${row.muscleGroup}`} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors text-sm text-zinc-300">
                            <td className="p-3 font-bold">{row.pushPull}</td>
                            <td className="p-3">{row.muscleGroup}</td>
                            <td className="p-3 font-mono">{formatCell(row.heavy, row.heavyVol)}</td>
                            <td className="p-3 font-mono">{formatCell(row.light, row.lightVol)}</td>
                            <td className="p-3 font-mono">{formatCell(row.medium, row.mediumVol)}</td>
                            <td className="p-3 font-mono font-bold text-white">{formatCell(row.total, row.totalVol)}</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-900/10 text-xs font-black border-b border-blue-900/20">
                          <td className="p-2 pl-3 uppercase tracking-widest text-blue-400" colSpan={2}>Subtotal {groupName}</td>
                          <td className="p-2 font-mono text-blue-300/70">{formatCell(subtotal.heavy, subtotal.heavyVol)}</td>
                          <td className="p-2 font-mono text-blue-300/70">{formatCell(subtotal.light, subtotal.lightVol)}</td>
                          <td className="p-2 font-mono text-blue-300/70">{formatCell(subtotal.medium, subtotal.mediumVol)}</td>
                          <td className="p-2 font-mono text-blue-300">{formatCell(subtotal.total, subtotal.totalVol)}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
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
  </div>
);
};
