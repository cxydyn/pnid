import React from 'react';
import { RCAInvestigation, SeverityLevel } from '../types';
import { ArrowLeft, Printer, Download, Share2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface PrintReportViewProps {
  rca: RCAInvestigation;
  onClose: () => void;
}

export const PrintReportView: React.FC<PrintReportViewProps> = ({ rca, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 overflow-y-auto">
      {/* NO-PRINT SCREEN HEADER */}
      <div className="sticky top-0 z-30 no-print bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>Back to Dashboard</span>
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <span className="text-xs font-semibold text-white">
            Formal RCA Executive Document (A4 Landscape Print Preview)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save to PDF</span>
          </button>
        </div>
      </div>

      {/* DOCUMENT PAGES CONTAINER (LIGHT THEME FOR FORMAL ENGINEERING REPORTS) */}
      <div className="flex-1 py-8 px-4 flex flex-col items-center gap-8 bg-slate-900 print:bg-white print:p-0">
        {/* ========================================================================= */}
        {/* PAGE 1: INCIDENT SUMMARY & FORENSIC ATTACHMENTS */}
        {/* ========================================================================= */}
        <section className="print-page w-full max-w-5xl bg-white text-slate-900 p-10 rounded-xl shadow-2xl print:shadow-none print:p-0 print:max-w-none print:rounded-none">
          {/* Document Header with Logo & Meta */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <div className="text-[11px] font-mono tracking-widest text-slate-500 uppercase">
                APEX INDUSTRIAL RELIABILITY & FORENSICS GROUP
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-950 mt-1 uppercase">
                ROOT CAUSE ANALYSIS (RCA) INVESTIGATION REPORT
              </h1>
              <div className="text-xs font-mono text-slate-600 mt-1">
                INCIDENT ID: RCA-{rca.equipmentTag}-{rca.incidentDate.substring(0, 10)}
              </div>
            </div>

            <div className="text-right">
              <span
                className={`inline-block px-3 py-1 text-xs font-bold rounded uppercase tracking-wider ${
                  rca.severity === 'Critical'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : rca.severity === 'Major'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}
              >
                {rca.severity} Severity
              </span>
              <div className="text-[11px] font-mono text-slate-500 mt-1">
                Date: {rca.incidentDate}
              </div>
            </div>
          </div>

          {/* Equipment & Plant Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs mb-6 font-sans">
            <div>
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Equipment Tag</div>
              <div className="text-sm font-bold font-mono text-slate-900">{rca.equipmentTag}</div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Equipment Name</div>
              <div className="font-semibold text-slate-900 truncate">{rca.equipmentName}</div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Plant Unit</div>
              <div className="font-semibold text-slate-900 truncate">{rca.plantUnit}</div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Investigation Status</div>
              <div className="font-bold text-emerald-700">Root Cause Confirmed</div>
            </div>
          </div>

          {/* Incident Description */}
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
              1. Incident Description & Sequence of Events
            </h2>
            <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
              {rca.description}
            </p>
          </div>

          {/* Field Facts */}
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
              2. Field Facts & Forensic Findings
            </h2>
            <div className="text-xs text-slate-800 leading-relaxed font-mono whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-200">
              {rca.fieldFacts}
            </div>
          </div>

          {/* Immediate Actions */}
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
              3. Immediate Containment Actions Taken
            </h2>
            <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
              {rca.immediateActions}
            </p>
          </div>

          {/* Attachments Section with Small / Medium / Large Print Sizing */}
          {rca.attachments.length > 0 && (
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-3">
                4. Field Evidence & Teardown Photographs
              </h2>
              <div className="flex flex-wrap gap-4 items-start">
                {rca.attachments.map((att) => {
                  let widthClass = 'w-1/2';
                  if (att.printSize === 'small') widthClass = 'w-1/4';
                  if (att.printSize === 'large') widthClass = 'w-full';

                  return (
                    <div
                      key={att.id}
                      className={`flex flex-col border border-slate-300 rounded p-2 bg-slate-50 ${widthClass}`}
                    >
                      {att.dataUrl && (
                        <div className="w-full h-44 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                          <img
                            src={att.dataUrl}
                            alt={att.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="text-[10px] text-slate-700 font-mono mt-1 font-medium">
                        {att.caption || att.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Page 1 Footer */}
          <div className="mt-8 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>RCA REPORT REF: {rca.id}</span>
            <span>PAGE 1 OF 4</span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PAGE 2: 5-WHYS CHAIN & CORRECTIVE ACTIONS (CAPA) */}
        {/* ========================================================================= */}
        <section className="print-page w-full max-w-5xl bg-white text-slate-900 p-10 rounded-xl shadow-2xl print:shadow-none print:p-0 print:max-w-none print:rounded-none">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-6">
            <div>
              <div className="text-[11px] font-mono tracking-widest text-slate-500 uppercase">
                SECTION B: ROOT CAUSE DETERMINATION
              </div>
              <h2 className="text-lg font-bold text-slate-950 uppercase">
                5-WHYS CAUSAL TRACEABILITY ANALYSIS
              </h2>
            </div>
            <div className="text-right text-xs font-mono text-slate-600">
              EQUIPMENT: {rca.equipmentTag}
            </div>
          </div>

          {/* Problem Statement Banner */}
          <div className="p-4 bg-slate-100 border-l-4 border-slate-800 rounded mb-6">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Problem Statement
            </div>
            <div className="text-xs font-bold text-slate-900 mt-1">{rca.fiveWhys.problem}</div>
          </div>

          {/* 5-Whys Ladder */}
          <div className="space-y-3 mb-8">
            {rca.fiveWhys.whys.map((why, idx) => {
              const isRoot = idx === 4;
              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded border ${
                    isRoot ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'
                  }`}
                  style={{ marginLeft: `${idx * 16}px` }}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className={isRoot ? 'text-rose-700' : 'text-slate-800'}>
                      {isRoot ? 'ROOT CAUSE (WHY #5):' : `WHY #${idx + 1}:`}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Tier {idx + 1}</span>
                  </div>
                  <div className="text-xs text-slate-800 font-sans leading-relaxed">{why}</div>
                </div>
              );
            })}
          </div>

          {/* CAPA Plan Table */}
          <div className="border border-slate-300 rounded overflow-hidden mb-6">
            <div className="bg-slate-900 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">
              Corrective & Preventive Action Plan (CAPA)
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="w-1/3 p-3 font-semibold bg-slate-50 text-slate-700">
                    Root Cause Summary
                  </td>
                  <td className="p-3 text-slate-900">{rca.fiveWhys.rootCauseSummary}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="w-1/3 p-3 font-semibold bg-slate-50 text-slate-700">
                    Permanent Corrective Actions
                  </td>
                  <td className="p-3 text-slate-900 whitespace-pre-wrap">
                    {rca.fiveWhys.correctiveAction}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="w-1/3 p-3 font-semibold bg-slate-50 text-slate-700">
                    Responsible Engineer
                  </td>
                  <td className="p-3 text-slate-900 font-medium">{rca.fiveWhys.responsibleParty}</td>
                </tr>
                <tr>
                  <td className="w-1/3 p-3 font-semibold bg-slate-50 text-slate-700">
                    Target Completion Date
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-900">{rca.fiveWhys.targetDate}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Page 2 Footer */}
          <div className="mt-8 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>RCA REPORT REF: {rca.id}</span>
            <span>PAGE 2 OF 4</span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PAGE 3: VISUAL FISHBONE (ISHIKAWA) DIAGRAM */}
        {/* ========================================================================= */}
        <section className="print-page w-full max-w-5xl bg-white text-slate-900 p-10 rounded-xl shadow-2xl print:shadow-none print:p-0 print:max-w-none print:rounded-none">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-6">
            <div>
              <div className="text-[11px] font-mono tracking-widest text-slate-500 uppercase">
                SECTION C: CAUSE & EFFECT MAPPING
              </div>
              <h2 className="text-lg font-bold text-slate-950 uppercase">
                ISHIKAWA FISHBONE DIAGRAM (6M ANALYSIS)
              </h2>
            </div>
            <div className="text-right text-xs font-mono text-slate-600">
              EQUIPMENT: {rca.equipmentTag}
            </div>
          </div>

          {/* Vector SVG Ishikawa Diagram Optimized for Print */}
          <div className="w-full my-6 border border-slate-200 rounded p-4 bg-slate-50">
            <svg viewBox="0 0 1000 450" className="w-full h-auto select-none font-sans">
              {/* Central Spine */}
              <line x1="80" y1="225" x2="820" y2="225" stroke="#0f172a" strokeWidth="4" />

              {/* Problem Effect Fish Head */}
              <polygon points="820,165 980,225 820,285" fill="#f8fafc" stroke="#0f172a" strokeWidth="2.5" />
              <foreignObject x="825" y="175" width="145" height="100">
                <div className="h-full flex flex-col items-center justify-center text-center p-1 text-slate-900">
                  <span className="text-[9px] font-bold text-slate-600 uppercase">PROBLEM EFFECT</span>
                  <span className="text-[11px] font-bold leading-tight mt-1">
                    {rca.fishbone.effect}
                  </span>
                </div>
              </foreignObject>

              {/* Bones: Manpower, Machine, Material */}
              <line x1="160" y1="50" x2="250" y2="225" stroke="#475569" strokeWidth="2.5" />
              <rect x="90" y="25" width="130" height="26" rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
              <text x="155" y="42" fill="#0f172a" fontSize="11" fontWeight="bold" textAnchor="middle">
                MANPOWER
              </text>

              <line x1="380" y1="50" x2="470" y2="225" stroke="#475569" strokeWidth="2.5" />
              <rect x="310" y="25" width="130" height="26" rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
              <text x="375" y="42" fill="#0f172a" fontSize="11" fontWeight="bold" textAnchor="middle">
                MACHINE
              </text>

              <line x1="600" y1="50" x2="690" y2="225" stroke="#475569" strokeWidth="2.5" />
              <rect x="530" y="25" width="130" height="26" rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
              <text x="595" y="42" fill="#0f172a" fontSize="11" fontWeight="bold" textAnchor="middle">
                MATERIAL
              </text>

              {/* Bones: Method, Measurement, Environment */}
              <line x1="160" y1="400" x2="250" y2="225" stroke="#475569" strokeWidth="2.5" />
              <rect x="90" y="400" width="130" height="26" rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
              <text x="155" y="417" fill="#0f172a" fontSize="11" fontWeight="bold" textAnchor="middle">
                METHOD
              </text>

              <line x1="380" y1="400" x2="470" y2="225" stroke="#475569" strokeWidth="2.5" />
              <rect x="310" y="400" width="130" height="26" rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
              <text x="375" y="417" fill="#0f172a" fontSize="11" fontWeight="bold" textAnchor="middle">
                MEASUREMENT
              </text>

              <line x1="600" y1="400" x2="690" y2="225" stroke="#475569" strokeWidth="2.5" />
              <rect x="530" y="400" width="130" height="26" rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
              <text x="595" y="417" fill="#0f172a" fontSize="11" fontWeight="bold" textAnchor="middle">
                ENVIRONMENT
              </text>

              {/* Causes Callouts */}
              {rca.fishbone.bones.manpower.map((c, idx) => (
                <g key={c.id}>
                  <line x1="130" y1={80 + idx * 35} x2="185" y2={80 + idx * 35} stroke="#64748b" strokeWidth="1" />
                  <rect x="15" y={68 + idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#fee2e2' : '#ffffff'} stroke={c.isPrimaryRoot ? '#b91c1c' : '#cbd5e1'} />
                  <text x="22" y={83 + idx * 35} fill={c.isPrimaryRoot ? '#991b1b' : '#1e293b'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                    {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                  </text>
                </g>
              ))}

              {rca.fishbone.bones.machine.map((c, idx) => (
                <g key={c.id}>
                  <line x1="350" y1={80 + idx * 35} x2="405" y2={80 + idx * 35} stroke="#64748b" strokeWidth="1" />
                  <rect x="235" y={68 + idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#fee2e2' : '#ffffff'} stroke={c.isPrimaryRoot ? '#b91c1c' : '#cbd5e1'} />
                  <text x="242" y={83 + idx * 35} fill={c.isPrimaryRoot ? '#991b1b' : '#1e293b'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                    {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                  </text>
                </g>
              ))}

              {rca.fishbone.bones.material.map((c, idx) => (
                <g key={c.id}>
                  <line x1="570" y1={80 + idx * 35} x2="625" y2={80 + idx * 35} stroke="#64748b" strokeWidth="1" />
                  <rect x="455" y={68 + idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#fee2e2' : '#ffffff'} stroke={c.isPrimaryRoot ? '#b91c1c' : '#cbd5e1'} />
                  <text x="462" y={83 + idx * 35} fill={c.isPrimaryRoot ? '#991b1b' : '#1e293b'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                    {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                  </text>
                </g>
              ))}

              {rca.fishbone.bones.method.map((c, idx) => (
                <g key={c.id}>
                  <line x1="130" y1={360 - idx * 35} x2="185" y2={360 - idx * 35} stroke="#64748b" strokeWidth="1" />
                  <rect x="15" y={348 - idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#fee2e2' : '#ffffff'} stroke={c.isPrimaryRoot ? '#b91c1c' : '#cbd5e1'} />
                  <text x="22" y={363 - idx * 35} fill={c.isPrimaryRoot ? '#991b1b' : '#1e293b'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                    {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                  </text>
                </g>
              ))}

              {rca.fishbone.bones.measurement.map((c, idx) => (
                <g key={c.id}>
                  <line x1="350" y1={360 - idx * 35} x2="405" y2={360 - idx * 35} stroke="#64748b" strokeWidth="1" />
                  <rect x="235" y={348 - idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#fee2e2' : '#ffffff'} stroke={c.isPrimaryRoot ? '#b91c1c' : '#cbd5e1'} />
                  <text x="242" y={363 - idx * 35} fill={c.isPrimaryRoot ? '#991b1b' : '#1e293b'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                    {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                  </text>
                </g>
              ))}

              {rca.fishbone.bones.environment.map((c, idx) => (
                <g key={c.id}>
                  <line x1="570" y1={360 - idx * 35} x2="625" y2={360 - idx * 35} stroke="#64748b" strokeWidth="1" />
                  <rect x="455" y={348 - idx * 35} width="165" height="22" rx="3" fill={c.isPrimaryRoot ? '#fee2e2' : '#ffffff'} stroke={c.isPrimaryRoot ? '#b91c1c' : '#cbd5e1'} />
                  <text x="462" y={363 - idx * 35} fill={c.isPrimaryRoot ? '#991b1b' : '#1e293b'} fontSize="9.5" fontWeight={c.isPrimaryRoot ? 'bold' : 'normal'}>
                    {c.text.length > 25 ? c.text.substring(0, 24) + '...' : c.text}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Page 3 Footer */}
          <div className="mt-8 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>RCA REPORT REF: {rca.id}</span>
            <span>PAGE 3 OF 4</span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PAGE 4: VISUAL FAULT TREE ANALYSIS (FTA) */}
        {/* ========================================================================= */}
        <section className="print-page w-full max-w-5xl bg-white text-slate-900 p-10 rounded-xl shadow-2xl print:shadow-none print:p-0 print:max-w-none print:rounded-none">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-6">
            <div>
              <div className="text-[11px] font-mono tracking-widest text-slate-500 uppercase">
                SECTION D: SYSTEMIC RELIABILITY LOGIC
              </div>
              <h2 className="text-lg font-bold text-slate-950 uppercase">
                BOOLEAN FAULT TREE LOGIC DIAGRAM
              </h2>
            </div>
            <div className="text-right text-xs font-mono text-slate-600">
              EQUIPMENT: {rca.equipmentTag}
            </div>
          </div>

          {/* Static Print Version of Fault Tree Hierarchy */}
          <div className="py-8 flex flex-col items-center">
            <PrintFaultTreeBranch nodeId="node-top" nodes={rca.faultTree.nodes} />
          </div>

          {/* Signoff Blocks */}
          <div className="grid grid-cols-3 gap-6 pt-12 mt-8 border-t border-slate-300 text-xs">
            <div>
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Lead Investigator</div>
              <div className="mt-6 border-b border-slate-400 pb-1 font-bold text-slate-900">
                Dr. E. Vance, PE (Chief Reliability Eng)
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Plant Operations Review</div>
              <div className="mt-6 border-b border-slate-400 pb-1 font-bold text-slate-900">
                M. Sterling (Operations Director)
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Quality & Safety Signoff</div>
              <div className="mt-6 border-b border-slate-400 pb-1 font-bold text-slate-900">
                K. Thorne (EHS Compliance Lead)
              </div>
            </div>
          </div>

          {/* Page 4 Footer */}
          <div className="mt-8 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>RCA REPORT REF: {rca.id}</span>
            <span>PAGE 4 OF 4 (FINAL)</span>
          </div>
        </section>
      </div>
    </div>
  );
};

/**
 * Print Read-Only Hierarchical Fault Tree Renderer
 */
const PrintFaultTreeBranch: React.FC<{ nodeId: string; nodes: any[] }> = ({ nodeId, nodes }) => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const children = nodes.filter((n) => n.parentId === nodeId);
  const isTop = node.type === 'top';
  const isGate = node.type === 'gate';

  return (
    <div className="flex flex-col items-center">
      <div
        className={`p-3 rounded border text-center shadow-xs min-w-[190px] max-w-[210px] ${
          isTop
            ? 'bg-slate-900 text-white border-slate-900'
            : isGate
            ? 'bg-slate-50 border-slate-800 text-slate-900'
            : 'bg-white border-slate-400 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between text-[9px] font-mono font-bold mb-1">
          <span className="bg-slate-200 text-slate-800 px-1 rounded">{node.code}</span>
          {node.gateType && (
            <span className="font-bold underline text-slate-700">{node.gateType} GATE</span>
          )}
          {node.probability !== undefined && (
            <span className="tabular-nums">P={node.probability.toFixed(2)}</span>
          )}
        </div>
        <div className="text-[11px] font-semibold leading-tight">{node.label}</div>
      </div>

      {children.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-5 bg-slate-400" />
          <div className="relative flex items-start gap-4 pt-1">
            {children.length > 1 && (
              <div
                className="absolute top-0 h-0.5 bg-slate-400"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: `calc(100% - 190px)`,
                }}
              />
            )}
            {children.map((child) => (
              <div key={child.id} className="flex flex-col items-center relative">
                <div className="w-0.5 h-3 bg-slate-400" />
                <PrintFaultTreeBranch nodeId={child.id} nodes={nodes} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
