import React, { useState } from 'react';
import { 
  TrendingUp, 
  PieChart, 
  BarChart2, 
  Clock, 
  ShieldAlert, 
  FileCheck2, 
  CheckCircle2, 
  AlertCircle, 
  Bookmark, 
  Building2, 
  Briefcase, 
  DollarSign, 
  Layers,
  ShieldCheck,
  Info,
  Plus,
  Trash2,
  Edit3,
  ExternalLink
} from 'lucide-react';

/** ----------------------------------------------------
 * 1. Financial Trend Line Chart Component (SVG + Inline Data Editor)
 * ---------------------------------------------------- */
export function DrhpLineChart({ data = [], title = "Financial Growth Trend (FY23 - FY25)", citations = [], onCitationClick }) {
  const [chartTitle, setChartTitle] = useState(title);
  const [pointsData, setPointsData] = useState(data.length > 0 ? data : [
    { year: 'FY23', revenue: 72, profit: 5.2 },
    { year: 'FY24', revenue: 95, profit: 7.5 },
    { year: 'FY25', revenue: 125, profit: 11.0 }
  ]);
  const [isEdited, setIsEdited] = useState(false);

  const padding = 40;
  const width = 500;
  const height = 200;

  const maxVal = Math.max(...pointsData.map(d => Math.max(Number(d.revenue) || 0, Number(d.profit) || 0))) * 1.15 || 100;
  
  const pointsRev = pointsData.map((d, i) => {
    const x = padding + (i * (width - 2 * padding)) / Math.max(pointsData.length - 1, 1);
    const y = height - padding - ((Number(d.revenue) || 0) / maxVal) * (height - 2 * padding);
    return { x, y, label: d.year, val: d.revenue, type: 'Revenue' };
  });

  const pointsPat = pointsData.map((d, i) => {
    const x = padding + (i * (width - 2 * padding)) / Math.max(pointsData.length - 1, 1);
    const y = height - padding - ((Number(d.profit) || 0) / maxVal) * (height - 2 * padding);
    return { x, y, label: d.year, val: d.profit, type: 'Profit (PAT)' };
  });

  const pathRev = pointsRev.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
  const pathPat = pointsPat.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');

  const handleUpdatePoint = (idx, field, val) => {
    const next = pointsData.map((p, i) => i === idx ? { ...p, [field]: val } : p);
    setPointsData(next);
    setIsEdited(true);
  };

  const handleAddPoint = () => {
    const nextYear = `FY${26 + pointsData.length}`;
    setPointsData([...pointsData, { year: nextYear, revenue: 140, profit: 14 }]);
    setIsEdited(true);
  };

  const handleRemovePoint = (idx) => {
    setPointsData(pointsData.filter((_, i) => i !== idx));
    setIsEdited(true);
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 space-y-4 font-sans relative group">
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
            <TrendingUp className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={chartTitle}
            onChange={(e) => { setChartTitle(e.target.value); setIsEdited(true); }}
            className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wider bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
          />
          {isEdited && (
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[9px] uppercase font-mono flex items-center gap-1">
              <Edit3 className="w-2.5 h-2.5" /> Edited by User
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold">
          <span className="flex items-center gap-1 text-indigo-600"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" /> Revenue (₹ Cr)</span>
          <span className="flex items-center gap-1 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> PAT (₹ Cr)</span>
        </div>
      </div>

      <div className="relative flex justify-center overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-lg h-48">
          {[0.25, 0.5, 0.75, 1].map((ratio, idx) => (
            <line key={idx} x1={padding} y1={height - padding - ratio * (height - 2 * padding)} x2={width - padding} y2={height - padding - ratio * (height - 2 * padding)} stroke="#e2e8f0" strokeDasharray="3 3" />
          ))}

          <path d={pathRev} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={pathPat} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {pointsRev.map((p, i) => (
            <g key={`rev-${i}`}>
              <circle cx={p.x} cy={p.y} r="5" fill="#4f46e5" />
              <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[10px] font-bold fill-indigo-700">{p.val} Cr</text>
              <text x={p.x} y={height - 12} textAnchor="middle" className="text-[10px] font-mono fill-slate-500">{p.label}</text>
            </g>
          ))}

          {pointsPat.map((p, i) => (
            <g key={`pat-${i}`}>
              <circle cx={p.x} cy={p.y} r="4" fill="#10b981" />
              <text x={p.x} y={p.y + 16} textAnchor="middle" className="text-[9px] font-bold fill-emerald-700">{p.val} Cr</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Interactive Data Point Spreadsheet Row */}
      <div className="space-y-2 pt-2 border-t border-slate-200/60">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase font-bold">
          <span>Edit Underlying Data Points</span>
          <button
            type="button"
            onClick={handleAddPoint}
            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold"
          >
            <Plus className="w-3 h-3" /> Add Year Data
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {pointsData.map((pt, pIdx) => (
            <div key={pIdx} className="p-2 bg-white border border-slate-200 rounded-xl space-y-1 relative group/pt">
              <button
                type="button"
                onClick={() => handleRemovePoint(pIdx)}
                className="absolute top-1 right-1 text-slate-300 hover:text-red-600 transition-colors"
                title="Remove year data"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <input
                type="text"
                value={pt.year}
                onChange={(e) => handleUpdatePoint(pIdx, 'year', e.target.value)}
                className="font-bold text-slate-800 text-[11px] font-mono w-20 border-b border-transparent focus:border-indigo-500 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div>
                  <label className="text-slate-400 block font-mono">Revenue Cr</label>
                  <input
                    type="number"
                    value={pt.revenue}
                    onChange={(e) => handleUpdatePoint(pIdx, 'revenue', parseFloat(e.target.value) || 0)}
                    className="w-full font-bold text-indigo-600 bg-indigo-50/50 rounded px-1 py-0.5 border border-indigo-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-mono">PAT Cr</label>
                  <input
                    type="number"
                    value={pt.profit}
                    onChange={(e) => handleUpdatePoint(pIdx, 'profit', parseFloat(e.target.value) || 0)}
                    className="w-full font-bold text-emerald-600 bg-emerald-50/50 rounded px-1 py-0.5 border border-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {citations.length > 0 && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 text-[10px]">
          <span className="text-slate-400 font-mono uppercase font-bold">Source:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 2. Donut Chart Component (SVG + Inline Segment Editor)
 * ---------------------------------------------------- */
export function DrhpDonutChart({ data = [], title = "Allocation Breakdown", citations = [], onCitationClick }) {
  const [chartTitle, setChartTitle] = useState(title);
  const [slicesData, setSlicesData] = useState(data.length > 0 ? data : [
    { label: 'Promoter Shareholding', value: 62.0 },
    { label: 'Promoter Group', value: 3.0 },
    { label: 'Public & Institutional', value: 35.0 }
  ]);
  const [isEdited, setIsEdited] = useState(false);

  const total = slicesData.reduce((acc, d) => acc + (Number(d.value) || 0), 0) || 1;

  let cumulativeAngle = 0;
  const slices = slicesData.map((d, i) => {
    const val = Number(d.value) || 0;
    const angle = (val / total) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return { ...d, startAngle, endAngle: cumulativeAngle, pct: Math.round((val / total) * 100) };
  });

  const colors = ['#4f46e5', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  const getCoordinatesForAngle = (angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: 100 + 75 * Math.cos(angleInRadians),
      y: 100 + 75 * Math.sin(angleInRadians)
    };
  };

  const handleUpdateSlice = (idx, field, val) => {
    const next = slicesData.map((s, i) => i === idx ? { ...s, [field]: val } : s);
    setSlicesData(next);
    setIsEdited(true);
  };

  const handleAddSlice = () => {
    setSlicesData([...slicesData, { label: 'New Category Segment', value: 10.0 }]);
    setIsEdited(true);
  };

  const handleRemoveSlice = (idx) => {
    setSlicesData(slicesData.filter((_, i) => i !== idx));
    setIsEdited(true);
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
            <PieChart className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={chartTitle}
            onChange={(e) => { setChartTitle(e.target.value); setIsEdited(true); }}
            className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wider bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
          />
          {isEdited && (
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[9px] uppercase font-mono flex items-center gap-1">
              <Edit3 className="w-2.5 h-2.5" /> Edited by User
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        {/* SVG Donut */}
        <div className="flex justify-center relative">
          <svg viewBox="0 0 200 200" className="w-44 h-44">
            {slices.map((s, idx) => {
              const start = getCoordinatesForAngle(s.startAngle);
              const end = getCoordinatesForAngle(s.endAngle);
              const largeArcFlag = s.endAngle - s.startAngle <= 180 ? '0' : '1';
              const pathData = `M 100 100 L ${start.x} ${start.y} A 75 75 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
              return (
                <path
                  key={idx}
                  d={pathData}
                  fill={colors[idx % colors.length]}
                  className="hover:opacity-90 transition-opacity stroke-white stroke-2"
                />
              );
            })}
            <circle cx="100" cy="100" r="45" fill="#ffffff" />
            <text x="100" y="95" textAnchor="middle" className="text-[10px] font-mono fill-slate-400 font-bold">TOTAL</text>
            <text x="100" y="112" textAnchor="middle" className="text-xs font-extrabold fill-slate-900">{total} Cr</text>
          </svg>
        </div>

        {/* Legend List & Editable Data Table */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase font-bold pb-1 border-b">
            <span>Edit Categories</span>
            <button
              type="button"
              onClick={handleAddSlice}
              className="flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-bold"
            >
              <Plus className="w-3 h-3" /> Add Segment
            </button>
          </div>
          {slices.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 gap-2">
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
                <input
                  type="text"
                  value={s.label}
                  onChange={(e) => handleUpdateSlice(idx, 'label', e.target.value)}
                  className="font-medium text-slate-700 text-xs bg-transparent focus:bg-slate-50 border-b border-transparent focus:border-indigo-500 focus:outline-none w-32"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={s.value}
                  onChange={(e) => handleUpdateSlice(idx, 'value', parseFloat(e.target.value) || 0)}
                  className="w-14 font-bold text-slate-900 text-xs text-right bg-slate-50 rounded px-1 py-0.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 font-mono">({s.pct}%)</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSlice(idx)}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {citations.length > 0 && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 text-[10px]">
          <span className="text-slate-400 font-mono uppercase font-bold">Source:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 3. Timeline Milestone Component (Inline Editable)
 * ---------------------------------------------------- */
export function DrhpTimeline({ milestones = [], title = "Company & Operations History Timeline", citations = [], onCitationClick }) {
  const [timelineTitle, setTimelineTitle] = useState(title);
  const [list, setList] = useState(milestones.length > 0 ? milestones : [
    { year: '2015', event: 'Company Incorporation', detail: 'Incorporated under Companies Act as a private limited entity.' },
    { year: '2018', event: 'MIDC Dombivli Plant Setup', detail: 'Setup primary 25,000 sq ft CNC manufacturing plant.' }
  ]);
  const [isEdited, setIsEdited] = useState(false);

  const handleUpdate = (idx, field, val) => {
    const next = list.map((m, i) => i === idx ? { ...m, [field]: val } : m);
    setList(next);
    setIsEdited(true);
  };

  const handleAdd = () => {
    setList([...list, { year: '2026', event: 'New Operational Milestone', detail: 'Milestone details disclosure.' }]);
    setIsEdited(true);
  };

  const handleRemove = (idx) => {
    setList(list.filter((_, i) => i !== idx));
    setIsEdited(true);
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
            <Clock className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={timelineTitle}
            onChange={(e) => { setTimelineTitle(e.target.value); setIsEdited(true); }}
            className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wider bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
          />
          {isEdited && (
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[9px] uppercase font-mono flex items-center gap-1">
              <Edit3 className="w-2.5 h-2.5" /> Edited by User
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add Milestone
        </button>
      </div>

      <div className="relative pl-6 space-y-4 border-l-2 border-indigo-200 ml-2">
        {list.map((m, idx) => (
          <div key={idx} className="relative group">
            <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={m.year}
                  onChange={(e) => handleUpdate(idx, 'year', e.target.value)}
                  className="font-mono text-xs font-extrabold text-indigo-600 w-24 bg-indigo-50/50 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                  title="Remove milestone"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={m.event}
                onChange={(e) => handleUpdate(idx, 'event', e.target.value)}
                className="text-xs font-bold text-slate-900 w-full bg-transparent focus:bg-slate-50 border-b border-transparent focus:border-indigo-500 focus:outline-none"
              />
              <textarea
                value={m.detail || ''}
                onChange={(e) => handleUpdate(idx, 'detail', e.target.value)}
                className="text-[11px] text-slate-600 leading-normal w-full bg-transparent focus:bg-slate-50 border border-transparent focus:border-slate-200 rounded p-1 focus:outline-none resize-y"
              />
            </div>
          </div>
        ))}
      </div>

      {citations.length > 0 && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 text-[10px]">
          <span className="text-slate-400 font-mono uppercase font-bold">Source:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 4. Highlights Statistics Cards Component (Inline Editable)
 * ---------------------------------------------------- */
export function DrhpStatCards({ stats = [], citations = [], onCitationClick }) {
  const [statList, setStatList] = useState(stats.length > 0 ? stats : [
    { label: 'Authorized Share Capital', value: '₹50.00 Cr', subtext: 'Equity shares of ₹10 each' },
    { label: 'Issued & Paid-up Capital', value: '₹32.50 Cr', subtext: 'Fully paid equity shares' }
  ]);
  const [isEdited, setIsEdited] = useState(false);

  const handleUpdate = (idx, field, val) => {
    const next = statList.map((s, i) => i === idx ? { ...s, [field]: val } : s);
    setStatList(next);
    setIsEdited(true);
  };

  const handleAdd = () => {
    setStatList([...statList, { label: 'New Metric Label', value: '₹10.00 Cr', subtext: 'Subtext description' }]);
    setIsEdited(true);
  };

  const handleRemove = (idx) => {
    setStatList(statList.filter((_, i) => i !== idx));
    setIsEdited(true);
  };

  return (
    <div className="space-y-3 font-sans relative group">
      <div className="flex items-center justify-between">
        {isEdited && (
          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[9px] uppercase font-mono flex items-center gap-1">
            <Edit3 className="w-2.5 h-2.5" /> Edited by User
          </span>
        )}
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 ml-auto"
        >
          <Plus className="w-3 h-3" /> Add Stat Card
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statList.map((s, idx) => (
          <div key={idx} className="bg-slate-50/90 border border-slate-200/80 p-3.5 rounded-2xl space-y-1.5 shadow-sm relative group/card">
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="absolute top-2 right-2 text-slate-300 hover:text-red-600 transition-colors"
              title="Remove stat card"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <input
              type="text"
              value={s.label}
              onChange={(e) => handleUpdate(idx, 'label', e.target.value)}
              className="text-[10px] text-slate-400 font-mono uppercase font-bold w-full bg-transparent focus:bg-white border-b border-transparent focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="text"
              value={s.value}
              onChange={(e) => handleUpdate(idx, 'value', e.target.value)}
              className="text-lg font-black text-slate-900 w-full bg-transparent focus:bg-white border-b border-transparent focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="text"
              value={s.subtext || ''}
              onChange={(e) => handleUpdate(idx, 'subtext', e.target.value)}
              className="text-[10px] text-emerald-600 font-semibold w-full bg-transparent focus:bg-white border-b border-transparent focus:border-emerald-500 focus:outline-none"
            />
          </div>
        ))}
      </div>

      {citations.length > 0 && (
        <div className="flex items-center gap-1.5 pt-1 text-[10px]">
          <span className="text-slate-400 font-mono uppercase font-bold">Source:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 5. Structured DRHP Disclosure Table (Spreadsheet Editable)
 * ---------------------------------------------------- */
export function DrhpStructuredTable({ title, headers = [], rows = [], citations = [], onCitationClick }) {
  const [tableTitle, setTableTitle] = useState(title || "Financial & Disclosure Table");
  const [colHeaders, setColHeaders] = useState(headers.length > 0 ? headers : ['Particulars', 'FY23 (₹ Cr)', 'FY24 (₹ Cr)', 'FY25 (₹ Cr)']);
  const [tableRows, setTableRows] = useState(
    rows.length > 0 
      ? rows.map(r => Array.isArray(r) ? r : [r.label || '', r.value || '']) 
      : [
          ['Revenue from Operations', '72.50', '95.20', '125.80'],
          ['EBITDA Margin (%)', '14.2%', '16.5%', '18.2%'],
          ['Profit After Tax (PAT)', '5.20', '7.50', '11.00']
        ]
  );
  const [isEdited, setIsEdited] = useState(false);

  const handleCellChange = (rIdx, cIdx, val) => {
    const nextRows = tableRows.map((row, r) => 
      r === rIdx ? row.map((cell, c) => c === cIdx ? val : cell) : row
    );
    setTableRows(nextRows);
    setIsEdited(true);
  };

  const handleHeaderChange = (cIdx, val) => {
    const nextHeaders = colHeaders.map((h, c) => c === cIdx ? val : h);
    setColHeaders(nextHeaders);
    setIsEdited(true);
  };

  const handleAddRow = () => {
    const emptyRow = new Array(colHeaders.length).fill('0.00');
    emptyRow[0] = 'New Particular Line Item';
    setTableRows([...tableRows, emptyRow]);
    setIsEdited(true);
  };

  const handleRemoveRow = (rIdx) => {
    setTableRows(tableRows.filter((_, r) => r !== rIdx));
    setIsEdited(true);
  };

  const handleAddColumn = () => {
    setColHeaders([...colHeaders, `Column ${colHeaders.length + 1}`]);
    setTableRows(tableRows.map(r => [...r, '-']));
    setIsEdited(true);
  };

  const handleRemoveColumn = (cIdx) => {
    if (colHeaders.length <= 1) return;
    setColHeaders(colHeaders.filter((_, c) => c !== cIdx));
    setTableRows(tableRows.map(r => r.filter((_, c) => c !== cIdx)));
    setIsEdited(true);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm space-y-0 font-sans">
      {/* Header Bar */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={tableTitle}
            onChange={(e) => { setTableTitle(e.target.value); setIsEdited(true); }}
            className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wider bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
          />
          {isEdited && (
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[9px] uppercase font-mono flex items-center gap-1">
              <Edit3 className="w-2.5 h-2.5" /> Edited by User
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-slate-400">{tableRows.length} Rows</span>
          <button
            type="button"
            onClick={handleAddColumn}
            className="px-2 py-1 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg font-bold flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Column
          </button>
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          {colHeaders.length > 0 && (
            <thead className="bg-slate-100/70 text-slate-600 font-mono text-[10px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="w-8 px-2 py-2 text-center text-slate-300">#</th>
                {colHeaders.map((h, cIdx) => (
                  <th key={cIdx} className="px-3 py-2.5 font-bold relative group/col border-r border-slate-200/50">
                    <div className="flex items-center justify-between gap-1">
                      <input
                        type="text"
                        value={h}
                        onChange={(e) => handleHeaderChange(cIdx, e.target.value)}
                        className="bg-transparent font-bold text-slate-700 focus:bg-white focus:outline-none w-full"
                      />
                      {colHeaders.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveColumn(cIdx)}
                          className="opacity-0 group-hover/col:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                          title="Delete column"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {tableRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors group/row">
                <td className="px-2 py-2 text-center font-mono text-[10px] text-slate-400 select-none">
                  {rIdx + 1}
                </td>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-2 border-r border-slate-100">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                      className={`w-full bg-transparent focus:bg-indigo-50/60 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        cIdx === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'
                      }`}
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(rIdx)}
                    className="opacity-0 group-hover/row:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
                    title="Delete row"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Row Action Footer */}
      <div className="p-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddRow}
          className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1 transition-all shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-600" /> Add Row
        </button>
      </div>

      {citations.length > 0 && (
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px]">
          <span className="text-slate-400 font-mono uppercase font-bold">Source:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 6. Risk Factor Disclosure Component (Inline Editable)
 * ---------------------------------------------------- */
export function DrhpRiskLegalCard({ riskNumber = 1, heading, description, impact, mitigation, evidence = [], onCitationClick }) {
  const [head, setHead] = useState(heading || "Risk Factor Disclosure Heading");
  const [desc, setDesc] = useState(description || "Detailed legal disclosure of risk factor.");
  const [imp, setImp] = useState(impact || "");
  const [mit, setMit] = useState(mitigation || "");
  const [isEdited, setIsEdited] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3.5 shadow-sm font-sans relative">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-black font-mono shrink-0">
            Risk #{riskNumber}
          </span>
          <textarea
            value={head}
            onChange={(e) => { setHead(e.target.value); setIsEdited(true); }}
            className="font-bold text-slate-900 text-sm leading-snug w-full bg-transparent focus:bg-slate-50 border-b border-transparent focus:border-indigo-500 focus:outline-none resize-y"
          />
        </div>
        {isEdited && (
          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[9px] uppercase font-mono flex items-center gap-1 shrink-0">
            <Edit3 className="w-2.5 h-2.5" /> Edited by User
          </span>
        )}
      </div>

      <div className="space-y-3 text-xs text-slate-700 leading-relaxed pl-1 border-l-2 border-slate-200">
        <div>
          <span className="font-bold text-slate-900 block mb-1">Detailed Disclosure & Background:</span>
          <textarea
            value={desc}
            onChange={(e) => { setDesc(e.target.value); setIsEdited(true); }}
            className="w-full p-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none min-h-[90px] resize-y"
          />
        </div>

        <div className="bg-red-50/40 border border-red-100 p-3 rounded-xl space-y-1">
          <span className="font-bold text-red-900 text-[11px] uppercase tracking-wider font-mono block">Potential Impact:</span>
          <textarea
            value={imp}
            onChange={(e) => { setImp(e.target.value); setIsEdited(true); }}
            placeholder="Specify financial or operating impact..."
            className="w-full p-1.5 bg-white/80 border border-red-200/60 rounded-lg text-xs text-red-800 focus:outline-none focus:ring-1 focus:ring-red-400 resize-y"
          />
        </div>

        <div className="bg-emerald-50/40 border border-emerald-100 p-3 rounded-xl space-y-1">
          <span className="font-bold text-emerald-900 text-[11px] uppercase tracking-wider font-mono block">Mitigation Strategy:</span>
          <textarea
            value={mit}
            onChange={(e) => { setMit(e.target.value); setIsEdited(true); }}
            placeholder="Specify risk mitigation actions..."
            className="w-full p-1.5 bg-white/80 border border-emerald-200/60 rounded-lg text-xs text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-y"
          />
        </div>
      </div>

      {evidence.length > 0 && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 text-[10px]">
          <span className="text-slate-400 font-mono uppercase font-bold">Evidence Grounding:</span>
          {evidence.map((ev, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(ev)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {ev.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 7. Statutory License & Compliance Matrix (Inline Editable)
 * ---------------------------------------------------- */
export function DrhpComplianceMatrix({ items = [], title = "Statutory Approvals & Compliance Matrix", citations = [], onCitationClick }) {
  const [matrixTitle, setMatrixTitle] = useState(title);
  const [list, setList] = useState(items.length > 0 ? items : [
    { name: 'Factory License', authority: 'DISH Maharashtra', refNo: 'FL/DOM/2019/882', validity: 'Valid till Dec 2026' }
  ]);
  const [isEdited, setIsEdited] = useState(false);

  const handleUpdate = (idx, field, val) => {
    const next = list.map((item, i) => i === idx ? { ...item, [field]: val } : item);
    setList(next);
    setIsEdited(true);
  };

  const handleAdd = () => {
    setList([...list, { name: 'New Statutory Registration', authority: 'Regulatory Body', refNo: 'REG/2026/001', validity: 'Permanent' }]);
    setIsEdited(true);
  };

  const handleRemove = (idx) => {
    setList(list.filter((_, i) => i !== idx));
    setIsEdited(true);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm font-sans">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <input
            type="text"
            value={matrixTitle}
            onChange={(e) => { setMatrixTitle(e.target.value); setIsEdited(true); }}
            className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wider bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
          />
          {isEdited && (
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[9px] uppercase font-mono flex items-center gap-1">
              <Edit3 className="w-2.5 h-2.5" /> Edited by User
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="px-2.5 py-1 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add License
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100/70 text-slate-600 font-mono text-[10px] uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5">Approval / License</th>
              <th className="px-4 py-2.5">Issuing Authority</th>
              <th className="px-4 py-2.5">Reference / Reg No.</th>
              <th className="px-4 py-2.5">Validity / Expiry</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {list.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleUpdate(idx, 'name', e.target.value)}
                    className="font-bold text-slate-900 w-full bg-transparent focus:bg-indigo-50/50 rounded px-1 py-0.5 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.authority}
                    onChange={(e) => handleUpdate(idx, 'authority', e.target.value)}
                    className="w-full bg-transparent focus:bg-indigo-50/50 rounded px-1 py-0.5 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.refNo}
                    onChange={(e) => handleUpdate(idx, 'refNo', e.target.value)}
                    className="font-mono text-[11px] w-full bg-transparent focus:bg-indigo-50/50 rounded px-1 py-0.5 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.validity}
                    onChange={(e) => handleUpdate(idx, 'validity', e.target.value)}
                    className="font-mono text-[11px] w-full bg-transparent focus:bg-indigo-50/50 rounded px-1 py-0.5 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {citations.length > 0 && (
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px]">
          <span className="text-slate-400 font-mono uppercase font-bold">Source:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 8. Litigation Summary Table (Inline Editable)
 * ---------------------------------------------------- */
export function DrhpLitigationTable({ cases = [], title = "Outstanding Legal Proceedings", citations = [], onCitationClick }) {
  const [tableTitle, setTableTitle] = useState(title);
  const [list, setList] = useState(cases.length > 0 ? cases : [
    { refNo: 'TAX/MUM/2023/104', authority: 'ITAT Mumbai', dispute: 'Direct Tax Deduction Dispute', amount: '₹1.85 Cr', status: 'Pending Hearing' }
  ]);
  const [isEdited, setIsEdited] = useState(false);

  const handleUpdate = (idx, field, val) => {
    const next = list.map((item, i) => i === idx ? { ...item, [field]: val } : item);
    setList(next);
    setIsEdited(true);
  };

  const handleAdd = () => {
    setList([...list, { refNo: 'CASE/2026/01', authority: 'High Court', dispute: 'Dispute description', amount: '₹0.50 Cr', status: 'Notice Issued' }]);
    setIsEdited(true);
  };

  const handleRemove = (idx) => {
    setList(list.filter((_, i) => i !== idx));
    setIsEdited(true);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm font-sans">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={tableTitle}
            onChange={(e) => { setTableTitle(e.target.value); setIsEdited(true); }}
            className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wider bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
          />
          {isEdited && (
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[9px] uppercase font-mono flex items-center gap-1">
              <Edit3 className="w-2.5 h-2.5" /> Edited by User
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Case
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100/70 text-slate-600 font-mono text-[10px] uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5">Case Reference</th>
              <th className="px-4 py-2.5">Authority / Forum</th>
              <th className="px-4 py-2.5">Nature of Dispute</th>
              <th className="px-4 py-2.5">Disputed Amount</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {list.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.refNo}
                    onChange={(e) => handleUpdate(idx, 'refNo', e.target.value)}
                    className="font-bold text-slate-900 font-mono w-full bg-transparent focus:bg-indigo-50/50 rounded px-1 py-0.5 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.authority}
                    onChange={(e) => handleUpdate(idx, 'authority', e.target.value)}
                    className="w-full bg-transparent focus:bg-indigo-50/50 rounded px-1 py-0.5 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.dispute}
                    onChange={(e) => handleUpdate(idx, 'dispute', e.target.value)}
                    className="w-full bg-transparent focus:bg-indigo-50/50 rounded px-1 py-0.5 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.amount}
                    onChange={(e) => handleUpdate(idx, 'amount', e.target.value)}
                    className="font-bold text-slate-900 w-full bg-transparent focus:bg-indigo-50/50 rounded px-1 py-0.5 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.status}
                    onChange={(e) => handleUpdate(idx, 'status', e.target.value)}
                    className="w-full bg-transparent font-bold text-amber-800 text-[11px] focus:bg-amber-50 rounded px-1 py-0.5 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {citations.length > 0 && (
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px]">
          <span className="text-slate-400 font-mono uppercase font-bold">Source:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 9. Analytical Risk Summary Matrix Component (Inline Editable)
 * ---------------------------------------------------- */
export function DrhpRiskSummaryCards({ title = "Analytical Risk Summary Matrix", data = [], citations = [], onCitationClick }) {
  const [matrixTitle, setMatrixTitle] = useState(title);
  const [list, setList] = useState(data.length > 0 ? data : [
    { category: 'Customer Concentration Risk', level: 'High', desc: 'Top 5 customers account for 48.2% of FY25 consolidated revenue.' },
    { category: 'Raw Material Volatility', level: 'Medium', desc: 'High grade alloy steel prices subject to global commodity index swings.' }
  ]);
  const [isEdited, setIsEdited] = useState(false);

  const handleUpdate = (idx, field, val) => {
    const next = list.map((item, i) => i === idx ? { ...item, [field]: val } : item);
    setList(next);
    setIsEdited(true);
  };

  const levelColor = (lvl) => {
    const l = String(lvl || '').toLowerCase();
    if (l === 'high') return 'bg-red-50 text-red-700 border-red-200';
    if (l === 'medium') return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-5 space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={matrixTitle}
            onChange={(e) => { setMatrixTitle(e.target.value); setIsEdited(true); }}
            className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wider bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
          />
          {isEdited && (
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[9px] uppercase font-mono flex items-center gap-1">
              <Edit3 className="w-2.5 h-2.5" /> Edited by User
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {list.map((item, idx) => (
          <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={item.category}
                onChange={(e) => handleUpdate(idx, 'category', e.target.value)}
                className="text-xs font-bold text-slate-900 w-full bg-transparent focus:bg-slate-50 border-b border-transparent focus:border-indigo-500 focus:outline-none"
              />
              <select
                value={item.level}
                onChange={(e) => handleUpdate(idx, 'level', e.target.value)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border focus:outline-none ${levelColor(item.level)}`}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <textarea
              value={item.desc}
              onChange={(e) => handleUpdate(idx, 'desc', e.target.value)}
              className="text-[11px] text-slate-600 leading-snug w-full bg-transparent focus:bg-slate-50 border border-transparent focus:border-slate-200 rounded p-1 focus:outline-none resize-y"
            />
          </div>
        ))}
      </div>

      {citations.length > 0 && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 text-[10px]">
          <span className="text-slate-400 font-mono uppercase font-bold">Source:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 10. Organization Hierarchy Tree Component (Inline Editable)
 * ---------------------------------------------------- */
export function DrhpOrgChart({ title = "Executive Management Hierarchy", data, citations = [], onCitationClick }) {
  const [chartTitle, setChartTitle] = useState(title);
  const [rootTitle, setRootTitle] = useState(data?.title || 'Managing Director & CEO');
  const [subRoles, setSubRoles] = useState(data?.sub || [
    { title: 'Chief Financial Officer (CFO)', sub: [{ title: 'VP Accounts' }, { title: 'Treasury Manager' }] },
    { title: 'Chief Operating Officer (COO)', sub: [{ title: 'VP Manufacturing' }, { title: 'Quality Head' }] }
  ]);
  const [isEdited, setIsEdited] = useState(false);

  return (
    <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-5 space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
            <Building2 className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={chartTitle}
            onChange={(e) => { setChartTitle(e.target.value); setIsEdited(true); }}
            className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wider bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
          />
          {isEdited && (
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[9px] uppercase font-mono flex items-center gap-1">
              <Edit3 className="w-2.5 h-2.5" /> Edited by User
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center space-y-4">
        {/* Top Root */}
        <input
          type="text"
          value={rootTitle}
          onChange={(e) => { setRootTitle(e.target.value); setIsEdited(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold text-center shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-300 min-w-[200px]"
        />
        
        {subRoles && subRoles.length > 0 && (
          <>
            <div className="w-0.5 h-4 bg-indigo-300" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
              {subRoles.map((node, nIdx) => (
                <div key={nIdx} className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm space-y-2 text-center">
                  <input
                    type="text"
                    value={node.title}
                    onChange={(e) => {
                      const next = subRoles.map((sr, i) => i === nIdx ? { ...sr, title: e.target.value } : sr);
                      setSubRoles(next);
                      setIsEdited(true);
                    }}
                    className="font-bold text-xs text-indigo-900 bg-indigo-50 py-1.5 px-2 rounded-lg text-center w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {node.sub && node.sub.length > 0 && (
                    <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-1.5">
                      {node.sub.map((leaf, lIdx) => (
                        <input
                          key={lIdx}
                          type="text"
                          value={leaf.title}
                          onChange={(e) => {
                            const nextSub = node.sub.map((lb, j) => j === lIdx ? { ...lb, title: e.target.value } : lb);
                            const next = subRoles.map((sr, i) => i === nIdx ? { ...sr, sub: nextSub } : sr);
                            setSubRoles(next);
                            setIsEdited(true);
                          }}
                          className="py-0.5 font-medium text-center text-slate-700 w-full bg-transparent focus:bg-slate-50 border-b border-transparent focus:border-slate-300 focus:outline-none text-[11px]"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {citations.length > 0 && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 text-[10px]">
          <span className="text-slate-400 font-mono uppercase font-bold">Source:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 11. Disclosure Callout Box Component (Inline Editable)
 * ---------------------------------------------------- */
export function DrhpCallout({ title, text, citations = [], onCitationClick }) {
  const [calloutTitle, setCalloutTitle] = useState(title || "Key Disclosure Note");
  const [calloutText, setCalloutText] = useState(text || "Disclosure note text...");
  const [isEdited, setIsEdited] = useState(false);

  return (
    <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl space-y-2 font-sans">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-600" />
          <input
            type="text"
            value={calloutTitle}
            onChange={(e) => { setCalloutTitle(e.target.value); setIsEdited(true); }}
            className="font-bold text-indigo-900 text-xs font-mono uppercase tracking-wider bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
          />
        </div>
        {isEdited && (
          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[9px] uppercase font-mono flex items-center gap-1">
            <Edit3 className="w-2.5 h-2.5" /> Edited by User
          </span>
        )}
      </div>

      <textarea
        value={calloutText}
        onChange={(e) => { setCalloutText(e.target.value); setIsEdited(true); }}
        className="text-xs text-indigo-950 leading-relaxed font-medium w-full bg-transparent focus:bg-white/80 border border-transparent focus:border-indigo-200 rounded p-1.5 focus:outline-none resize-y min-h-[60px]"
      />

      {citations.length > 0 && (
        <div className="flex items-center gap-1.5 pt-2 text-[10px]">
          <span className="text-indigo-400 font-mono uppercase font-bold">Source:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 12. Standard Disclosure Narrative Component (Inline Editable)
 * ---------------------------------------------------- */
export function DrhpNarrative({ text, citations = [], onCitationClick }) {
  const [narrativeText, setNarrativeText] = useState(text || "");
  const [isEdited, setIsEdited] = useState(false);

  return (
    <div className="space-y-2 font-sans group relative">
      <div className="relative">
        <textarea
          value={narrativeText}
          onChange={(e) => { setNarrativeText(e.target.value); setIsEdited(true); }}
          className="w-full text-xs text-slate-800 leading-relaxed font-normal p-2.5 bg-transparent hover:bg-slate-50/60 focus:bg-white border border-transparent focus:border-indigo-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[70px] resize-y transition-all"
        />
        {isEdited && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[9px] uppercase font-mono flex items-center gap-1">
            <Edit3 className="w-2.5 h-2.5" /> Edited by User
          </span>
        )}
      </div>

      {citations.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-slate-400 font-mono uppercase font-bold">Source:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()} <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 13. Dynamic DRHP Block Composition Renderer
 * ---------------------------------------------------- */
export function DrhpBlockRenderer({ block, onCitationClick }) {
  if (!block) return null;

  switch (block.type) {
    case 'stat_cards':
      return <DrhpStatCards stats={block.stats} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'line_chart':
      return <DrhpLineChart title={block.title} data={block.data} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'donut_chart':
    case 'pie_chart':
      return <DrhpDonutChart title={block.title} data={block.data} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'timeline':
      return <DrhpTimeline title={block.title} milestones={block.milestones} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'table':
    case 'financial_table':
      return <DrhpStructuredTable title={block.title} headers={block.headers} rows={block.rows} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'compliance_matrix':
      return <DrhpComplianceMatrix title={block.title} items={block.items} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'litigation_table':
      return <DrhpLitigationTable title={block.title} cases={block.cases} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'risk_card':
      return <DrhpRiskLegalCard riskNumber={block.data?.riskNumber || 1} heading={block.data?.heading} description={block.data?.description} impact={block.data?.impact} mitigation={block.data?.mitigation} evidence={block.data?.evidence || block.citations} onCitationClick={onCitationClick} />;
    case 'risk_summary_cards':
      return <DrhpRiskSummaryCards title={block.title} data={block.data} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'org_chart':
      return <DrhpOrgChart title={block.title} data={block.data} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'callout':
      return <DrhpCallout title={block.title} text={block.text} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'narrative':
    default:
      return <DrhpNarrative text={block.text} citations={block.citations} onCitationClick={onCitationClick} />;
  }
}

