import React, { useState, useRef } from 'react';
import { RCAInvestigation, SeverityLevel, AttachmentItem, FishboneCause, FaultTreeNode, GateType } from '../types';
import {
  ArrowLeft,
  Printer,
  FileText,
  HelpCircle,
  GitPullRequest,
  GitBranch,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Edit2,
  Save,
  Check,
  Maximize2
} from 'lucide-react';
import { saveAttachmentBinary } from '../utils/db';

interface RcaDashboardProps {
  rca: RCAInvestigation;
  onUpdateRca: (updatedRca: RCAInvestigation) => void;
  onBackToViewer: () => void;
  onOpenPrintReport: () => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

type TabType = 'incident' | '5whys' | 'fishbone' | 'fault_tree';

export const RcaDashboard: React.FC<RcaDashboardProps> = ({
  rca,
  onUpdateRca,
  onBackToViewer,
  onOpenPrintReport,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('incident');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [newCauseInput, setNewCauseInput] = useState<{ boneKey: string; text: string }>({
    boneKey: '',
    text: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to update top-level RCA fields
  const updateField = (field: keyof RCAInvestigation, value: any) => {
    const updated = {
      ...rca,
      [field]: value,
      lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    onUpdateRca(updated);
  };

  // 1. INCIDENT REPORT: Handle Attachment Upload
  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const attId = `att-${Date.now()}`;
      await saveAttachmentBinary(attId, dataUrl);

      const newAttachment: AttachmentItem = {
        id: attId,
        name: file.name,
        type: file.type,
        caption: `Field evidence photograph of ${rca.equipmentTag}`,
        printSize: 'medium',
        storageKey: attId,
        dataUrl: dataUrl,
      };

      const updatedAttachments = [...rca.attachments, newAttachment];
      updateField('attachments', updatedAttachments);
      onShowToast('success', 'Attachment Uploaded', file.name);
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Delete attachment
  const handleDeleteAttachment = (id: string) => {
    const updated = rca.attachments.filter((a) => a.id !== id);
    updateField('attachments', updated);
    onShowToast('info', 'Attachment deleted');
  };

  // Update attachment caption or print size
  const handleUpdateAttachmentMeta = (id: string, caption: string, printSize: 'small' | 'medium' | 'large') => {
    const updated = rca.attachments.map((a) => (a.id === id ? { ...a, caption, printSize } : a));
    updateField('attachments', updated);
  };

  // 2. 5-WHYS: Update specific why step
  const handleUpdateWhy = (index: number, text: string) => {
    const newWhys = [...rca.fiveWhys.whys] as [string, string, string, string, string];
    newWhys[index] = text;
    updateField('fiveWhys', {
      ...rca.fiveWhys,
      whys: newWhys,
    });
  };

  // 3. FISHBONE: Add cause to category
  const handleAddFishboneCause = (boneKey: keyof typeof rca.fishbone.bones) => {
    if (!newCauseInput.text.trim()) return;
    const newCause: FishboneCause = {
      id: `cause-${Date.now()}`,
      text: newCauseInput.text.trim(),
    };
    const currentList = rca.fishbone.bones[boneKey] || [];
    const updatedBones = {
      ...rca.fishbone.bones,
      [boneKey]: [...currentList, newCause],
    };
    updateField('fishbone', {
      ...rca.fishbone,
      bones: updatedBones,
    });
    setNewCauseInput({ boneKey: '', text: '' });
    onShowToast('success', 'Cause Added', `Added to ${boneKey.toUpperCase()}`);
  };

  // Toggle primary root cause status on fishbone cause
  const handleTogglePrimaryCause = (boneKey: keyof typeof rca.fishbone.bones, causeId: string) => {
    const currentList = rca.fishbone.bones[boneKey] || [];
    const updated = currentList.map((c) => (c.id === causeId ? { ...c, isPrimaryRoot: !c.isPrimaryRoot } : c));
    const updatedBones = {
      ...rca.fishbone.bones,
      [boneKey]: updated,
    };
    updateField('fishbone', {
      ...rca.fishbone,
      bones: updatedBones,
    });
  };

  // Delete fishbone cause
  const handleDeleteFishboneCause = (boneKey: keyof typeof rca.fishbone.bones, causeId: string) => {
    const currentList = rca.fishbone.bones[boneKey] || [];
    const updated = currentList.filter((c) => c.id !== causeId);
    const updatedBones = {
      ...rca.fishbone.bones,
      [boneKey]: updated,
    };
    updateField('fishbone', {
      ...rca.fishbone,
      bones: updatedBones,
    });
  };

  // 4. FAULT TREE: Add child node (gate or basic event)
  const handleAddFaultTreeNode = (parentId: string, type: 'gate' | 'basic_event', gateType?: GateType) => {
    const newId = `ft-${Date.now()}`;
    const codeNum = rca.faultTree.nodes.length + 1;
    const newNode: FaultTreeNode = {
      id: newId,
      parentId,
      type,
      gateType: type === 'gate' ? gateType || 'OR' : undefined,
      label: type === 'gate' ? 'Intermediate Fault Gate' : 'Basic Failure Event',
      code: type === 'gate' ? `G${codeNum}` : `E${codeNum}`,
      probability: type === 'basic_event' ? 0.05 : undefined,
    };
    updateField('faultTree', {
      ...rca.faultTree,
      nodes: [...rca.faultTree.nodes, newNode],
    });
    onShowToast('success', 'Tree Node Added', newNode.label);
  };

  // Delete node and its children
  const handleDeleteFaultTreeNode = (nodeId: string) => {
    if (nodeId === 'node-top' || rca.faultTree.nodes.find((n) => n.id === nodeId)?.parentId === null) {
      onShowToast('warning', 'Top Event Locked', 'Cannot delete the top event of the fault tree.');
      return;
    }
    // Recursively collect all descendant IDs
    const toDelete = new Set<string>([nodeId]);
    let added = true;
    while (added) {
      added = false;
      rca.faultTree.nodes.forEach((n) => {
        if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
          toDelete.add(n.id);
          added = true;
        }
      });
    }
    const remaining = rca.faultTree.nodes.filter((n) => !toDelete.has(n.id));
    updateField('faultTree', {
      ...rca.faultTree,
      nodes: remaining,
    });
    onShowToast('info', 'Node deleted');
  };

  // Update node details
  const handleUpdateFaultTreeNode = (nodeId: string, updates: Partial<FaultTreeNode>) => {
    const updated = rca.faultTree.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n));
    updateField('faultTree', {
      ...rca.faultTree,
      nodes: updated,
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Hidden File Input for incident attachments */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleUploadAttachment}
      />

      {/* TOP HEADER: RCA Investigation Bar */}
      <header className="h-16 shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-5 flex items-center justify-between gap-4 z-20">
        {/* Left: Navigation & Incident Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToViewer}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>P&ID View</span>
          </button>
          <div className="h-5 w-px bg-slate-800" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/70 border border-rose-800/60 px-2 py-0.5 rounded">
                {rca.equipmentTag}
              </span>
              <h2 className="text-sm font-bold text-white truncate max-w-sm md:max-w-xl">
                {rca.incidentTitle}
              </h2>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
              {rca.equipmentName} · {rca.plantUnit}
            </div>
          </div>
        </div>

        {/* Right: Print / Document View Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenPrintReport}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            title="Open Clean A4 Document & Print View"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Document & Print View</span>
          </button>
        </div>
      </header>

      {/* 4 TABS NAVIGATION BAR */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-5 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('incident')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'incident'
              ? 'border-cyan-400 text-white bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4 text-cyan-400" />
          <span>Incident Report</span>
          {rca.attachments.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-800 rounded text-slate-300">
              {rca.attachments.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('5whys')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === '5whys'
              ? 'border-cyan-400 text-white bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span>5-Whys Analysis</span>
        </button>

        <button
          onClick={() => setActiveTab('fishbone')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'fishbone'
              ? 'border-cyan-400 text-white bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitPullRequest className="w-4 h-4 text-emerald-400" />
          <span>Visual Fishbone (Ishikawa)</span>
        </button>

        <button
          onClick={() => setActiveTab('fault_tree')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'fault_tree'
              ? 'border-cyan-400 text-white bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitBranch className="w-4 h-4 text-rose-400" />
          <span>Fault Tree Analysis (FTA)</span>
        </button>
      </div>

      {/* MAIN TAB CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
        {/* ========================================================================= */}
        {/* TAB 1: INCIDENT REPORT */}
        {/* ========================================================================= */}
        {activeTab === 'incident' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Metadata Fields Header Card */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Incident Title</label>
                  <input
                    type="text"
                    value={rca.incidentTitle}
                    onChange={(e) => updateField('incidentTitle', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Incident Timestamp</label>
                  <input
                    type="text"
                    value={rca.incidentDate}
                    onChange={(e) => updateField('incidentDate', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Severity Classification</label>
                  <select
                    value={rca.severity}
                    onChange={(e) => updateField('severity', e.target.value as SeverityLevel)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-semibold"
                  >
                    <option value="Critical">Critical (Immediate Plant Risk)</option>
                    <option value="Major">Major (Unit Trip / High Damage)</option>
                    <option value="Moderate">Moderate (Derate / Component Failure)</option>
                    <option value="Minor">Minor (Inspection Finding)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Equipment Tag & Description</label>
                  <input
                    type="text"
                    value={rca.equipmentName}
                    onChange={(e) => updateField('equipmentName', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Plant Operating Area / Unit</label>
                  <input
                    type="text"
                    value={rca.plantUnit}
                    onChange={(e) => updateField('plantUnit', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>
            </div>

            {/* Description & Field Facts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl flex flex-col">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Incident Description & Sequence of Events</span>
                </label>
                <textarea
                  rows={8}
                  value={rca.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Describe initial operating conditions, trip alarms, symptoms observed..."
                  className="w-full flex-1 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed font-sans"
                />
              </div>

              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl flex flex-col">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span>Field Facts & Forensic Findings</span>
                </label>
                <textarea
                  rows={8}
                  value={rca.fieldFacts}
                  onChange={(e) => updateField('fieldFacts', e.target.value)}
                  placeholder="Physical evidence gathered, pressure/vibration data, teardown inspection observations..."
                  className="w-full flex-1 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed font-mono text-[11px]"
                />
              </div>
            </div>

            {/* Immediate Actions */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 block">
                Immediate Containment Actions Taken
              </label>
              <textarea
                rows={3}
                value={rca.immediateActions}
                onChange={(e) => updateField('immediateActions', e.target.value)}
                placeholder="Lockout/tagout, standby equipment start, isolation valves closed..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed"
              />
            </div>

            {/* Evidence Attachments Section with Small/Medium/Large Print Sizing */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Investigation Attachments & Evidence ({rca.attachments.length})
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Field photos, metallurgy micrographs, and test reports stored offline in IndexedDB.
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Evidence</span>
                </button>
              </div>

              {rca.attachments.length === 0 ? (
                <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
                  No attachments uploaded. Click 'Upload Evidence' to attach site inspection photos.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rca.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="border border-slate-800 rounded-xl p-3 bg-slate-950 flex flex-col justify-between gap-3"
                    >
                      <div>
                        {/* Image Preview Container */}
                        <div className="w-full h-44 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
                          {att.dataUrl ? (
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-slate-600" />
                          )}
                        </div>

                        {/* Caption Editor */}
                        <div className="mt-2.5">
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                            Caption:
                          </label>
                          <input
                            type="text"
                            value={att.caption}
                            onChange={(e) => handleUpdateAttachmentMeta(att.id, e.target.value, att.printSize)}
                            className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                          />
                        </div>
                      </div>

                      {/* Print Size Selection & Delete */}
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 uppercase font-bold">Print Size:</span>
                          {(['small', 'medium', 'large'] as const).map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => handleUpdateAttachmentMeta(att.id, att.caption, size)}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors ${
                                att.printSize === size
                                  ? 'bg-cyan-600 text-white font-bold'
                                  : 'bg-slate-900 text-slate-400 hover:text-white'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded"
                          title="Delete attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: 5-WHYS ANALYSIS */}
        {/* ========================================================================= */}
        {activeTab === '5whys' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  5-Whys Problem Tracing Method
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Iteratively peel back layers of symptoms to drill down to fundamental procedural or systemic root causes.
                </p>
              </div>

              {/* Problem Statement Box */}
              <div>
                <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                  Observed Problem Statement
                </label>
                <textarea
                  rows={2}
                  value={rca.fiveWhys.problem}
                  onChange={(e) =>
                    updateField('fiveWhys', { ...rca.fiveWhys, problem: e.target.value })
                  }
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-medium"
                />
              </div>

              {/* Tiered Why 1 - Why 5 Form */}
              <div className="space-y-3.5 pt-2">
                {rca.fiveWhys.whys.map((whyText, index) => {
                  const isRoot = index === 4;
                  return (
                    <div
                      key={index}
                      className={`relative p-3.5 rounded-xl border transition-all ${
                        isRoot
                          ? 'bg-rose-950/40 border-rose-800/80'
                          : 'bg-slate-950/80 border-slate-800'
                      }`}
                      style={{ marginLeft: `${index * 12}px` }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-xs font-mono font-bold ${
                            isRoot ? 'text-rose-400' : 'text-cyan-400'
                          }`}
                        >
                          {isRoot ? 'WHY #5 (IDENTIFIED ROOT CAUSE):' : `WHY #${index + 1}:`}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Tier {index + 1} of 5</span>
                      </div>
                      <textarea
                        rows={2}
                        value={whyText}
                        onChange={(e) => handleUpdateWhy(index, e.target.value)}
                        placeholder={`Explain cause for Why #${index}...`}
                        className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Corrective & Preventive Action Plan (CAPA) */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Corrective & Preventive Action Plan (CAPA)
                </h4>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Root Cause Summary</label>
                  <textarea
                    rows={2}
                    value={rca.fiveWhys.rootCauseSummary}
                    onChange={(e) =>
                      updateField('fiveWhys', { ...rca.fiveWhys, rootCauseSummary: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Permanent Corrective Actions</label>
                  <textarea
                    rows={3}
                    value={rca.fiveWhys.correctiveAction}
                    onChange={(e) =>
                      updateField('fiveWhys', { ...rca.fiveWhys, correctiveAction: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Responsible Engineer / Department</label>
                    <input
                      type="text"
                      value={rca.fiveWhys.responsibleParty}
                      onChange={(e) =>
                        updateField('fiveWhys', { ...rca.fiveWhys, responsibleParty: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Target Completion Date</label>
                    <input
                      type="date"
                      value={rca.fiveWhys.targetDate}
                      onChange={(e) =>
                        updateField('fiveWhys', { ...rca.fiveWhys, targetDate: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: VISUAL FISHBONE (ISHIKAWA DIAGRAM) */}
        {/* ========================================================================= */}
        {activeTab === 'fishbone' && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Visual SVG Diagram Canvas */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-x-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Cause & Effect Ishikawa Diagram
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Categorized cause vectors leading to the primary failure effect. Primary root causes marked in red.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-slate-300 font-medium">Primary Root Cause</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                    <span className="text-slate-400">Contributing Factor</span>
                  </div>
                </div>
              </div>

              {/* Dynamic SVG Fishbone Rendering */}
              <div className="min-w-[900px] py-4">
                <svg viewBox="0 0 1000 450" className="w-full h-auto select-none font-sans">
                  {/* Central Spine Line (Thick Gray/Cyan) */}
                  <line x1="80" y1="225" x2="820" y2="225" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />

                  {/* Fish Head / Effect Box */}
                  <polygon points="820,165 980,225 820,285" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" />
                  <foreignObject x="825" y="180" width="145" height="90">
                    <div className="h-full flex flex-col items-center justify-center text-center p-1">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase">PROBLEM EFFECT</span>
                      <span className="text-[11px] font-bold text-white leading-tight mt-1 line-clamp-3">
                        {rca.fishbone.effect}
                      </span>
                    </div>
                  </foreignObject>

                  {/* 6 Orthogonal Bones */}
                  {/* Top 3: Manpower (x=240), Machine (x=460), Material (x=680) */}
                  {/* 1. Manpower */}
                  <line x1="160" y1="50" x2="250" y2="225" stroke="#94a3b8" strokeWidth="3" />
                  <rect x="90" y="25" width="130" height="26" rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                  <text x="155" y="42" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
                    MANPOWER
                  </text>

                  {/* 2. Machine */}
                  <line x1="380" y1="50" x2="470" y2="225" stroke="#94a3b8" strokeWidth="3" />
                  <rect x="310" y="25" width="130" height="26" rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                  <text x="375" y="42" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
                    MACHINE
                  </text>

                  {/* 3. Material */}
                  <line x1="600" y1="50" x2="690" y2="225" stroke="#94a3b8" strokeWidth="3" />
                  <rect x="530" y="25" width="130" height="26" rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                  <text x="595" y="42" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
                    MATERIAL
                  </text>

                  {/* Bottom 3: Method (x=250), Measurement (x=470), Environment (x=690) */}
                  {/* 4. Method */}
                  <line x1="160" y1="400" x2="250" y2="225" stroke="#94a3b8" strokeWidth="3" />
                  <rect x="90" y="400" width="130" height="26" rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                  <text x="155" y="417" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
                    METHOD
                  </text>

                  {/* 5. Measurement */}
                  <line x1="380" y1="400" x2="470" y2="225" stroke="#94a3b8" strokeWidth="3" />
                  <rect x="310" y="400" width="130" height="26" rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                  <text x="375" y="417" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
                    MEASUREMENT
                  </text>

                  {/* 6. Environment */}
                  <line x1="600" y1="400" x2="690" y2="225" stroke="#94a3b8" strokeWidth="3" />
                  <rect x="530" y="400" width="130" height="26" rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                  <text x="595" y="417" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
                    ENVIRONMENT
                  </text>

                  {/* Render Cause Callouts on Bones */}
                  {/* Manpower Causes */}
                  {rca.fishbone.bones.manpower.map((c, idx) => (
                    <g key={c.id}>
                      <line x1="130" y1={80 + idx * 35} x2="185" y2={80 + idx * 35} stroke={c.isPrimaryRoot ? '#ef4444' : '#64748b'} strokeWidth="1.5" />
                      <rect x="15" y={68 + idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#450a0a' : '#0f172a'} stroke={c.isPrimaryRoot ? '#ef4444' : '#334155'} />
                      <text x="22" y={83 + idx * 35} fill={c.isPrimaryRoot ? '#fca5a5' : '#e2e8f0'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                        {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                      </text>
                    </g>
                  ))}

                  {/* Machine Causes */}
                  {rca.fishbone.bones.machine.map((c, idx) => (
                    <g key={c.id}>
                      <line x1="350" y1={80 + idx * 35} x2="405" y2={80 + idx * 35} stroke={c.isPrimaryRoot ? '#ef4444' : '#64748b'} strokeWidth="1.5" />
                      <rect x="235" y={68 + idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#450a0a' : '#0f172a'} stroke={c.isPrimaryRoot ? '#ef4444' : '#334155'} />
                      <text x="242" y={83 + idx * 35} fill={c.isPrimaryRoot ? '#fca5a5' : '#e2e8f0'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                        {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                      </text>
                    </g>
                  ))}

                  {/* Material Causes */}
                  {rca.fishbone.bones.material.map((c, idx) => (
                    <g key={c.id}>
                      <line x1="570" y1={80 + idx * 35} x2="625" y2={80 + idx * 35} stroke={c.isPrimaryRoot ? '#ef4444' : '#64748b'} strokeWidth="1.5" />
                      <rect x="455" y={68 + idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#450a0a' : '#0f172a'} stroke={c.isPrimaryRoot ? '#ef4444' : '#334155'} />
                      <text x="462" y={83 + idx * 35} fill={c.isPrimaryRoot ? '#fca5a5' : '#e2e8f0'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                        {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                      </text>
                    </g>
                  ))}

                  {/* Method Causes (Bottom) */}
                  {rca.fishbone.bones.method.map((c, idx) => (
                    <g key={c.id}>
                      <line x1="130" y1={360 - idx * 35} x2="185" y2={360 - idx * 35} stroke={c.isPrimaryRoot ? '#ef4444' : '#64748b'} strokeWidth="1.5" />
                      <rect x="15" y={348 - idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#450a0a' : '#0f172a'} stroke={c.isPrimaryRoot ? '#ef4444' : '#334155'} />
                      <text x="22" y={363 - idx * 35} fill={c.isPrimaryRoot ? '#fca5a5' : '#e2e8f0'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                        {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                      </text>
                    </g>
                  ))}

                  {/* Measurement Causes (Bottom) */}
                  {rca.fishbone.bones.measurement.map((c, idx) => (
                    <g key={c.id}>
                      <line x1="350" y1={360 - idx * 35} x2="405" y2={360 - idx * 35} stroke={c.isPrimaryRoot ? '#ef4444' : '#64748b'} strokeWidth="1.5" />
                      <rect x="235" y={348 - idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#450a0a' : '#0f172a'} stroke={c.isPrimaryRoot ? '#ef4444' : '#334155'} />
                      <text x="242" y={363 - idx * 35} fill={c.isPrimaryRoot ? '#fca5a5' : '#e2e8f0'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                        {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                      </text>
                    </g>
                  ))}

                  {/* Environment Causes (Bottom) */}
                  {rca.fishbone.bones.environment.map((c, idx) => (
                    <g key={c.id}>
                      <line x1="570" y1={360 - idx * 35} x2="625" y2={360 - idx * 35} stroke={c.isPrimaryRoot ? '#ef4444' : '#64748b'} strokeWidth="1.5" />
                      <rect x="455" y={348 - idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#450a0a' : '#0f172a'} stroke={c.isPrimaryRoot ? '#ef4444' : '#334155'} />
                      <text x="462" y={363 - idx * 35} fill={c.isPrimaryRoot ? '#fca5a5' : '#e2e8f0'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                        {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Fishbone Cause Management Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {(
                [
                  { key: 'manpower', label: 'Manpower / Personnel' },
                  { key: 'machine', label: 'Machine / Equipment' },
                  { key: 'material', label: 'Material / Gaskets / Flu' },
                  { key: 'method', label: 'Method / Procedures' },
                  { key: 'measurement', label: 'Measurement / Sensors' },
                  { key: 'environment', label: 'Environment / Conditions' },
                ] as const
              ).map((bone) => (
                <div
                  key={bone.key}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 shadow flex flex-col justify-between"
                >
                  <div>
                    <h4 className="font-bold text-white uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-800 flex items-center justify-between">
                      <span>{bone.label}</span>
                      <span className="text-[10px] text-cyan-400 font-mono">
                        {rca.fishbone.bones[bone.key].length} Causes
                      </span>
                    </h4>

                    {/* Causes List */}
                    <div className="space-y-2 mb-3">
                      {rca.fishbone.bones[bone.key].map((cause) => (
                        <div
                          key={cause.id}
                          className={`p-2 rounded-lg border flex items-start justify-between gap-2 transition-colors ${
                            cause.isPrimaryRoot
                              ? 'bg-rose-950/50 border-rose-800/80 text-rose-200'
                              : 'bg-slate-950/80 border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="leading-snug flex-1">{cause.text}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleTogglePrimaryCause(bone.key, cause.id)}
                              className={`p-1 rounded text-[10px] font-bold ${
                                cause.isPrimaryRoot
                                  ? 'bg-rose-600 text-white'
                                  : 'text-slate-500 hover:text-white'
                              }`}
                              title={cause.isPrimaryRoot ? 'Unmark Primary Root Cause' : 'Mark as Primary Root Cause'}
                            >
                              ★
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFishboneCause(bone.key, cause.id)}
                              className="p-1 text-slate-500 hover:text-rose-400"
                              title="Delete Cause"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add Cause Input */}
                  <div className="pt-2 border-t border-slate-800/60 flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder={`Add cause to ${bone.key}...`}
                      value={newCauseInput.boneKey === bone.key ? newCauseInput.text : ''}
                      onChange={(e) => setNewCauseInput({ boneKey: bone.key, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddFishboneCause(bone.key);
                      }}
                      className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddFishboneCause(bone.key)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded transition-colors"
                      title="Add"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: FAULT TREE ANALYSIS (FTA) */}
        {/* ========================================================================= */}
        {activeTab === 'fault_tree' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Interactive Fault Tree Logic Model
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hierarchical Boolean logic gates (AND / OR) determining equipment failure probability.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-cyan-950 border border-cyan-700 rounded text-cyan-300 font-bold">
                      AND
                    </span>
                    <span className="text-slate-400">All inputs must fail</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-amber-950 border border-amber-700 rounded text-amber-300 font-bold">
                      OR
                    </span>
                    <span className="text-slate-400">Any single input triggers fault</span>
                  </div>
                </div>
              </div>

              {/* Hierarchical Fault Tree Renderer */}
              <div className="overflow-x-auto py-6 min-w-[800px]">
                {/* Recursive Node Tree Component */}
                <FaultTreeBranch
                  nodeId="node-top"
                  nodes={rca.faultTree.nodes}
                  onAddChild={handleAddFaultTreeNode}
                  onDeleteNode={handleDeleteFaultTreeNode}
                  onUpdateNode={handleUpdateFaultTreeNode}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

/**
 * Recursive Branch Component for Fault Tree Logic Hierarchy
 */
interface FaultTreeBranchProps {
  nodeId: string;
  nodes: FaultTreeNode[];
  onAddChild: (parentId: string, type: 'gate' | 'basic_event', gateType?: GateType) => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<FaultTreeNode>) => void;
}

const FaultTreeBranch: React.FC<FaultTreeBranchProps> = ({
  nodeId,
  nodes,
  onAddChild,
  onDeleteNode,
  onUpdateNode,
}) => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const children = nodes.filter((n) => n.parentId === nodeId);
  const isTop = node.type === 'top';
  const isGate = node.type === 'gate';
  const isBasic = node.type === 'basic_event';

  return (
    <div className="flex flex-col items-center">
      {/* Node Box */}
      <div
        className={`relative z-10 p-3 rounded-xl border text-center shadow-lg transition-all min-w-[210px] max-w-[240px] group ${
          isTop
            ? 'bg-rose-950/80 border-rose-500 text-white'
            : isGate
            ? 'bg-slate-900 border-cyan-500/70 text-slate-100'
            : 'bg-slate-950 border-amber-500/70 text-slate-200'
        }`}
      >
        {/* Node Tag & Code */}
        <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-1">
          <span className="text-cyan-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
            {node.code}
          </span>
          {node.gateType && (
            <span
              className={`px-1.5 py-0.5 rounded ${
                node.gateType === 'AND' ? 'bg-cyan-900 text-cyan-200' : 'bg-amber-900 text-amber-200'
              }`}
            >
              {node.gateType} GATE
            </span>
          )}
          {node.probability !== undefined && (
            <span className="text-amber-400 tabular-nums">P={node.probability.toFixed(2)}</span>
          )}
        </div>

        {/* Label */}
        <div className="text-xs font-semibold leading-tight my-1 break-words">{node.label}</div>

        {/* Action Controls on Hover */}
        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
          {/* Add Child Gate or Event if not a leaf event */}
          {!isBasic && (
            <>
              <button
                type="button"
                onClick={() => onAddChild(node.id, 'gate', 'OR')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-cyan-900 text-[10px] text-cyan-300 font-mono rounded"
                title="Add OR Gate"
              >
                + OR
              </button>
              <button
                type="button"
                onClick={() => onAddChild(node.id, 'gate', 'AND')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-cyan-900 text-[10px] text-cyan-300 font-mono rounded"
                title="Add AND Gate"
              >
                + AND
              </button>
              <button
                type="button"
                onClick={() => onAddChild(node.id, 'basic_event')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-amber-900 text-[10px] text-amber-300 font-mono rounded"
                title="Add Basic Failure Event"
              >
                + Event
              </button>
            </>
          )}

          {!isTop && (
            <button
              type="button"
              onClick={() => onDeleteNode(node.id)}
              className="p-1 text-slate-500 hover:text-rose-400 rounded"
              title="Delete node & branch"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Children Hierarchy with Orthogonal Connector Lines */}
      {children.length > 0 && (
        <div className="flex flex-col items-center">
          {/* Vertical stem from parent down */}
          <div className="w-0.5 h-6 bg-slate-700" />

          {/* Children container with horizontal connecting bar */}
          <div className="relative flex items-start gap-6 pt-2">
            {/* Horizontal connector bar across siblings */}
            {children.length > 1 && (
              <div
                className="absolute top-0 h-0.5 bg-slate-700"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: `calc(100% - 210px)`,
                }}
              />
            )}

            {children.map((child) => (
              <div key={child.id} className="flex flex-col items-center relative">
                {/* Vertical line from horizontal bus down into child node */}
                <div className="w-0.5 h-4 bg-slate-700" />
                <FaultTreeBranch
                  nodeId={child.id}
                  nodes={nodes}
                  onAddChild={onAddChild}
                  onDeleteNode={onDeleteNode}
                  onUpdateNode={onUpdateNode}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
