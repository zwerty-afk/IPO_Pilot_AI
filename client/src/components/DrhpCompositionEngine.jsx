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
  ExternalLink,
  Search,
  Table,
  BookOpen,
  Check,
  History,
  RefreshCw
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
 * 13. SECTION 1.1: DRHP DEFINITIONS & ABBREVIATIONS GLOSSARY
 * ---------------------------------------------------- */
export const GLOSSARY_CATEGORIES = [
  "Company Related Terms",
  "Offer Related Terms",
  "Legal & Regulatory Terms",
  "Financial Terms",
  "Corporate Governance Terms",
  "Industry Specific Terms",
  "General Abbreviations"
];

export function DrhpGlossarySection({ company = {}, intake = {}, citations = [], onCitationClick }) {
  const companyName = company.legal_name || company.name || intake.company_details?.legal_name || 'Aarav Precision Engineering Pvt Ltd';
  const cin = company.cin || intake.company_details?.cin || 'U29220MH2015PTC263456';
  const incDate = company.incorporation_date || intake.company_details?.incorporation_date || '2015-04-12';
  const regOffice = intake.company_details?.registered_office || 'W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane, Maharashtra - 421204';
  const promoterNames = intake.promoters?.promoters_list || 'Aarav Mehta & Rohan Mehta';
  const auditorName = intake.legal_compliance?.auditor_details || 'M/s Shah & Associates, Chartered Accountants (FRN: 104920W)';
  const mbName = intake.legal_compliance?.merchant_banker_details || 'Apex Capital Advisors Pvt Ltd (SEBI Reg: INM000012490)';

  const initialTerms = [
    // 1. Company Related Terms
    { id: 'g-1', category: 'Company Related Terms', term: 'Company / Our Company', description: `${companyName}, a private limited company incorporated on ${incDate} under the Companies Act with Corporate Identification Number ${cin}.` },
    { id: 'g-2', category: 'Company Related Terms', term: 'Registered Office', description: regOffice },
    { id: 'g-3', category: 'Company Related Terms', term: 'Promoters', description: `${promoterNames}, being the individual promoters of our Company.` },
    { id: 'g-4', category: 'Company Related Terms', term: 'Promoter Group', description: 'Includes Aarav Mehta, Rohan Mehta, Mrs. Sunita Mehta, and Aarav Precision Tooling Ltd.' },
    { id: 'g-5', category: 'Company Related Terms', term: 'Group Companies', description: 'Mehta Industrial Properties and Mehta CNC Tooling Solutions.' },

    // 2. Offer Related Terms
    { id: 'g-6', category: 'Offer Related Terms', term: 'Draft Red Herring Prospectus (DRHP)', description: 'This Draft Red Herring Prospectus dated February 2026 issued in accordance with SEBI ICDR Regulations.' },
    { id: 'g-7', category: 'Offer Related Terms', term: 'Red Herring Prospectus (RHP)', description: 'The prospectus to be filed with ROC after approval of DRHP, containing the price band or issue price.' },
    { id: 'g-8', category: 'Offer Related Terms', term: 'Offer / Issue', description: 'Initial Public Offering of Equity Shares by our Company aggregating up to ₹50,000,000.' },
    { id: 'g-9', category: 'Offer Related Terms', term: 'Equity Shares', description: 'Equity shares of our Company having face value of ₹10 each.' },
    { id: 'g-10', category: 'Offer Related Terms', term: 'Lead Manager / Merchant Banker', description: mbName },
    { id: 'g-11', category: 'Offer Related Terms', term: 'Registrar to the Issue', description: 'Bigshare Services Pvt Ltd (SEBI Reg: INR000001385).' },

    // 3. Legal & Regulatory Terms
    { id: 'g-12', category: 'Legal & Regulatory Terms', term: 'SEBI ICDR Regulations', description: 'Securities and Exchange Board of India (Issue of Capital and Disclosure Requirements) Regulations, 2018 as amended.' },
    { id: 'g-13', category: 'Legal & Regulatory Terms', term: 'Companies Act', description: 'The Companies Act, 2013 and applicable rules framed thereunder.' },
    { id: 'g-14', category: 'Legal & Regulatory Terms', term: 'SEBI', description: 'Securities and Exchange Board of India constituted under the SEBI Act, 1992.' },
    { id: 'g-15', category: 'Legal & Regulatory Terms', term: 'ROC', description: 'Registrar of Companies, Mumbai, Maharashtra.' },
    { id: 'g-16', category: 'Legal & Regulatory Terms', term: 'ASBA', description: 'Application Supported by Blocked Amount mechanism for bidding in the Issue.' },
    { id: 'g-17', category: 'Legal & Regulatory Terms', term: 'UPI', description: 'Unified Payments Interface mechanism for retail individual bidders.' },

    // 4. Financial Terms
    { id: 'g-18', category: 'Financial Terms', term: 'Restated Financial Statements', description: 'Restated Statement of Assets and Liabilities, Profit & Loss, and Cash Flows for FY23, FY24, and FY25.' },
    { id: 'g-19', category: 'Financial Terms', term: 'Statutory Auditors', description: auditorName },
    { id: 'g-20', category: 'Financial Terms', term: 'Net Worth', description: 'Aggregate value of paid-up equity share capital and reserves (₹42.50 Cr for FY25).' },
    { id: 'g-21', category: 'Financial Terms', term: 'Net Tangible Assets', description: 'Tangible assets net of total liabilities (Exceeds ₹3.00 Cr requirement under SEBI Reg 6(1)).' },
    { id: 'g-22', category: 'Financial Terms', term: 'EBITDA', description: 'Earnings Before Interest, Taxes, Depreciation, and Amortization.' },
    { id: 'g-23', category: 'Financial Terms', term: 'PAT', description: 'Profit After Tax.' },

    // 5. Corporate Governance Terms
    { id: 'g-24', category: 'Corporate Governance Terms', term: 'Board / Board of Directors', description: 'Board of Directors of Aarav Precision Engineering Pvt Ltd.' },
    { id: 'g-25', category: 'Corporate Governance Terms', term: 'Managing Director', description: 'Aarav Mehta, Managing Director of the Company.' },
    { id: 'g-26', category: 'Corporate Governance Terms', term: 'CFO', description: 'Chief Financial Officer of the Company.' },
    { id: 'g-27', category: 'Corporate Governance Terms', term: 'Company Secretary', description: 'M/s K. V. & Associates, Practicing Company Secretaries.' },
    { id: 'g-28', category: 'Corporate Governance Terms', term: 'Audit Committee', description: 'Audit Committee of the Board constituted under Section 177 of the Companies Act, 2013.' },

    // 6. Industry Specific Terms
    { id: 'g-29', category: 'Industry Specific Terms', term: 'CNC / VMC', description: 'Computer Numerical Control / Vertical Machining Center equipped at Dombivli facility.' },
    { id: 'g-30', category: 'Industry Specific Terms', term: 'AS9100D', description: 'Aerospace Quality Management System standard certified for defense precision component supply.' },
    { id: 'g-31', category: 'Industry Specific Terms', term: 'MIDC', description: 'Maharashtra Industrial Development Corporation.' },
    { id: 'g-32', category: 'Industry Specific Terms', term: 'Metrology Lab', description: 'CMM (Coordinate Measuring Machine) quality inspection laboratory.' },

    // 7. General Abbreviations
    { id: 'g-33', category: 'General Abbreviations', term: 'AY', description: 'Assessment Year under the Income Tax Act.' },
    { id: 'g-34', category: 'General Abbreviations', term: 'CAGR', description: 'Compounded Annual Growth Rate.' },
    { id: 'g-35', category: 'General Abbreviations', term: 'CIN', description: 'Corporate Identity Number.' },
    { id: 'g-36', category: 'General Abbreviations', term: 'DIN', description: 'Director Identification Number.' },
    { id: 'g-37', category: 'General Abbreviations', term: 'EPFO', description: "Employees' Provident Fund Organisation." },
    { id: 'g-38', category: 'General Abbreviations', term: 'GSTIN', description: 'Goods and Services Tax Identification Number.' }
  ];

  const [terms, setTerms] = useState(initialTerms);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTermText, setEditTermText] = useState('');
  const [editDescText, setEditDescText] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newCat, setNewCat] = useState(GLOSSARY_CATEGORIES[0]);
  const [newTerm, setNewTerm] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const filteredTerms = terms.filter(t => {
    const matchesCat = activeCategory === 'All' || t.category === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || t.term.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  const categoriesToRender = activeCategory === 'All'
    ? GLOSSARY_CATEGORIES.filter(cat => terms.some(t => t.category === cat))
    : [activeCategory];

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditTermText(item.term);
    setEditDescText(item.description);
  };

  const handleSaveEdit = (id) => {
    setTerms(prev => prev.map(t => t.id === id ? { ...t, term: editTermText, description: editDescText } : t));
    setEditingId(null);
  };

  const handleDeleteTerm = (id) => {
    setTerms(prev => prev.filter(t => t.id !== id));
  };

  const handleAddTerm = (e) => {
    e.preventDefault();
    if (!newTerm.trim() || !newDesc.trim()) return;
    const newItem = {
      id: `g-custom-${Date.now()}`,
      category: newCat,
      term: newTerm.trim(),
      description: newDesc.trim()
    };
    setTerms(prev => [...prev, newItem]);
    setNewTerm('');
    setNewDesc('');
    setShowAddRow(false);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>1.1 SEBI DRHP Glossary & Master Definitions</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-populated from Intake data & SEBI statutory templates. Fully editable by Merchant Banker.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search glossary..."
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 w-44"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAddRow(!showAddRow)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Term</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveCategory('All')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === 'All'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Categories ({terms.length})
        </button>
        {GLOSSARY_CATEGORIES.map(cat => {
          const count = terms.filter(t => t.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Inline Add Term Form */}
      {showAddRow && (
        <form onSubmit={handleAddTerm} className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-3 animate-fade-in">
          <h4 className="text-xs font-bold text-indigo-950 uppercase font-mono tracking-wider flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-indigo-600" /> Add New Glossary Term
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Category</label>
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
              >
                {GLOSSARY_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Term / Abbreviation</label>
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder="e.g. EBITDA / Company"
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Description</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Full disclosure definition..."
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddRow(false)}
              className="px-3 py-1.5 bg-white text-slate-600 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
            >
              Save Term
            </button>
          </div>
        </form>
      )}

      {/* Render Tables Categorized */}
      <div className="space-y-6">
        {categoriesToRender.map(cat => {
          const categoryTerms = filteredTerms.filter(t => t.category === cat);
          if (categoryTerms.length === 0) return null;

          return (
            <div key={cat} className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-indigo-600" />
                <span>{cat}</span>
              </h4>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <th className="py-2.5 px-4 w-1/3">Term</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4 w-20 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {categoryTerms.map(item => {
                      const isEditingThis = editingId === item.id;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 align-top">
                            {isEditingThis ? (
                              <input
                                type="text"
                                value={editTermText}
                                onChange={(e) => setEditTermText(e.target.value)}
                                className="w-full p-1.5 border border-indigo-300 rounded text-xs focus:outline-none"
                              />
                            ) : (
                              item.term
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 leading-relaxed align-top">
                            {isEditingThis ? (
                              <textarea
                                value={editDescText}
                                onChange={(e) => setEditDescText(e.target.value)}
                                className="w-full p-1.5 border border-indigo-300 rounded text-xs focus:outline-none min-h-[60px]"
                              />
                            ) : (
                              item.description
                            )}
                          </td>
                          <td className="py-3 px-4 align-top text-center">
                            {isEditingThis ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(item.id)}
                                  className="p-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded cursor-pointer"
                                  title="Save"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(item)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                  title="Edit Row"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTerm(item.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                  title="Delete Row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {citations.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] pt-2 border-t border-slate-100 font-sans">
          <span className="text-slate-400 font-mono uppercase font-bold">Grounding Citations:</span>
          {citations.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onCitationClick && onCitationClick(c)}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bookmark className="w-2.5 h-2.5 text-indigo-400" /> {c.split(': ').pop()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 14. SECTION 1.2: CERTAIN CONVENTIONS, FINANCIAL & MARKET DATA
 * ---------------------------------------------------- */
export function DrhpConventionsSection({ company = {}, intake = {}, citations = [], onCitationClick }) {
  const [cardsData, setCardsData] = useState({
    currency: "All references in this Draft Red Herring Prospectus to 'INR', 'Rs.', 'Rupees', or '₹' are to the Indian Rupee, the official currency of the Republic of India. Financial amounts are presented in Indian Rupees and formatted in Crores (1 Crore = 10,000,000 INR) or Lakhs (1 Lakh = 100,000 INR) unless otherwise specified.",
    financial: "Financial information included in this DRHP is derived from our Restated Financial Statements for FY 2022-23, FY 2023-24, and FY 2024-25, prepared in accordance with Indian Accounting Standards (Ind AS) / Indian GAAP and the Companies Act, 2013. Our Fiscal Year commences on April 1 and ends on March 31 of the following calendar year.",
    market: "Market and industry data used throughout this DRHP has been obtained from CRISIL Research Report, Ministry of Heavy Industries, MCA filings, and official government publications. Industry publications generally state that the information contained therein has been obtained from sources believed to be reliable.",
    numerical: "Certain numerical figures and percentages in this DRHP have been subject to rounding adjustments. Component figures in tables may not sum exactly to stated totals due to rounding off to two decimal places."
  });

  const [sources] = useState([
    { id: 'src-1', title: 'Audited FS FY25', desc: 'Audited Financial Statements for FY 2024-25', badge: 'Audited FS FY25' },
    { id: 'src-2', title: 'CRISIL Industry Report', desc: 'CRISIL Research Precision Engineering Outlook', badge: 'CRISIL Report' },
    { id: 'src-3', title: 'MCA ROC Vault', desc: 'Ministry of Corporate Affairs ROC Filings', badge: 'MCA' },
    { id: 'src-4', title: 'Intake Questionnaire', desc: 'Verified Company Profile Intake Data', badge: 'Intake: Company Details' }
  ]);

  const [editingCard, setEditingCard] = useState(null);
  const [editText, setEditText] = useState('');

  const handleStartEdit = (key) => {
    setEditingCard(key);
    setEditText(cardsData[key]);
  };

  const handleSaveCard = (key) => {
    setCardsData(prev => ({ ...prev, [key]: editText }));
    setEditingCard(null);
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-600" />
          <span>1.2 Certain Conventions, Presentation of Financial & Market Data</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          SEBI disclosure conventions regarding currency notation, restated financial reporting, market research sources, and rounding rules.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Currency Convention */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 relative group">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Currency Convention
            </h4>
            <button
              type="button"
              onClick={() => editingCard === 'currency' ? handleSaveCard('currency') : handleStartEdit('currency')}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              {editingCard === 'currency' ? <><Check className="w-3 h-3 text-emerald-600" /> Save</> : <><Edit3 className="w-3 h-3" /> Edit</>}
            </button>
          </div>
          {editingCard === 'currency' ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full p-2 text-xs border border-indigo-300 rounded-xl focus:outline-none min-h-[90px]"
            />
          ) : (
            <p className="text-xs text-slate-700 leading-relaxed font-sans">{cardsData.currency}</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">INR / ₹</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200 text-[10px]">Crore & Lakh Format</span>
          </div>
        </div>

        {/* Card 2: Financial Reporting */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 relative group">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-indigo-600" /> Financial Reporting Standards
            </h4>
            <button
              type="button"
              onClick={() => editingCard === 'financial' ? handleSaveCard('financial') : handleStartEdit('financial')}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              {editingCard === 'financial' ? <><Check className="w-3 h-3 text-emerald-600" /> Save</> : <><Edit3 className="w-3 h-3" /> Edit</>}
            </button>
          </div>
          {editingCard === 'financial' ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full p-2 text-xs border border-indigo-300 rounded-xl focus:outline-none min-h-[90px]"
            />
          ) : (
            <p className="text-xs text-slate-700 leading-relaxed font-sans">{cardsData.financial}</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[10px]">Ind AS / Indian GAAP</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200 text-[10px]">Fiscal Year: April 1 – March 31</span>
          </div>
        </div>

        {/* Card 3: Market Data Sources */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 relative group">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600" /> Market & Industry Data Sources
            </h4>
            <button
              type="button"
              onClick={() => editingCard === 'market' ? handleSaveCard('market') : handleStartEdit('market')}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              {editingCard === 'market' ? <><Check className="w-3 h-3 text-emerald-600" /> Save</> : <><Edit3 className="w-3 h-3" /> Edit</>}
            </button>
          </div>
          {editingCard === 'market' ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full p-2 text-xs border border-indigo-300 rounded-xl focus:outline-none min-h-[90px]"
            />
          ) : (
            <p className="text-xs text-slate-700 leading-relaxed font-sans">{cardsData.market}</p>
          )}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px]">CRISIL Report</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200 text-[10px]">Govt Sources</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200 text-[10px]">MCA Filings</span>
          </div>
        </div>

        {/* Card 4: Numerical Conventions */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 relative group">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> Numerical Conventions
            </h4>
            <button
              type="button"
              onClick={() => editingCard === 'numerical' ? handleSaveCard('numerical') : handleStartEdit('numerical')}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              {editingCard === 'numerical' ? <><Check className="w-3 h-3 text-emerald-600" /> Save</> : <><Edit3 className="w-3 h-3" /> Edit</>}
            </button>
          </div>
          {editingCard === 'numerical' ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full p-2 text-xs border border-indigo-300 rounded-xl focus:outline-none min-h-[90px]"
            />
          ) : (
            <p className="text-xs text-slate-700 leading-relaxed font-sans">{cardsData.numerical}</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200 text-[10px]">2 Decimal Places</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200 text-[10px]">Component Total Match</span>
          </div>
        </div>
      </div>

      {/* Data Sources Grid (Source Badges) */}
      <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3">
        <h4 className="text-xs font-bold text-indigo-950 uppercase font-mono tracking-wider flex items-center gap-1.5">
          <Bookmark className="w-3.5 h-3.5 text-indigo-600" /> Mapped Grounding Data Sources
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {sources.map(src => (
            <div key={src.id} className="p-3 bg-white border border-indigo-100 rounded-xl space-y-1 hover:border-indigo-300 transition-all">
              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono text-[9px] font-bold uppercase inline-block">
                {src.badge}
              </span>
              <p className="text-xs font-bold text-slate-800">{src.title}</p>
              <p className="text-[10px] text-slate-500">{src.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** ----------------------------------------------------
 * 15. SECTION 1.3: FORWARD LOOKING STATEMENTS
 * ---------------------------------------------------- */
export function DrhpForwardLookingSection({ company = {}, intake = {}, citations = [], onCitationClick }) {
  const defaultStatement = `This Draft Red Herring Prospectus contains certain forward-looking statements that involve risks and uncertainties. All statements other than statements of historical facts contained in this DRHP, including statements regarding our Company's future financial position, business strategy, expansion plans, financial targets, and objectives of management for future operations, are forward-looking statements.

These statements can generally be identified by words or phrases such as "aim", "anticipate", "believe", "expect", "estimate", "intend", "objective", "plan", "project", "shall", "will", "will continue", "will pursue", or other words of similar import.

Forward-looking statements contained in this DRHP regarding our growth strategies in precision machining, expansion of 5-axis CNC capacities, customer retention, raw material supply contracts, and financial projections are based on assumptions regarding our present and future business strategies and the environment in which we operate.

Actual results could differ materially from those expressed or implied in such forward-looking statements due to various factors, including:
1. Volatility in prices of raw materials (alloy steel, brass ingots) and power tariffs.
2. High customer concentration and dependency on top Tier-1 automotive OEMs.
3. Operational risks associated with a single manufacturing facility at Dombivli, Thane.
4. Pending legal proceedings and income tax appeals before the CIT(A), Mumbai.
5. Changes in government policies, SEBI ICDR regulations, and general economic conditions in India.

Neither our Company, the Promoters, the Lead Manager, nor any of their respective affiliates undertake any obligation to update or revise any forward-looking statement, whether as a result of new information, future events, or otherwise, except as required by SEBI (ICDR) Regulations, 2018 or applicable law.`;

  const [statementText, setStatementText] = useState(defaultStatement);
  const [originalText, setOriginalText] = useState(defaultStatement);
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [accepted, setAccepted] = useState(true);

  const handleRegenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const refreshed = defaultStatement + `\n\n[SEBI ICDR Schedule VI legal disclosure re-verified on ${new Date().toLocaleDateString()}]`;
      setStatementText(refreshed);
      setAccepted(false);
      setIsGenerating(false);
    }, 600);
  };

  const handleAcceptChanges = () => {
    setOriginalText(statementText);
    setAccepted(true);
    setIsDiffMode(false);
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Header & AI Workflow Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
            <span>1.3 Forward Looking Statements</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            SEBI DRHP statutory legal disclaimer covering projections, risk disclosures, and update obligations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all border border-slate-200 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>Regenerate AI</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDiffMode(!isDiffMode)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all border cursor-pointer ${
              isDiffMode
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Compare Versions</span>
          </button>

          {!accepted && (
            <button
              type="button"
              onClick={handleAcceptChanges}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all shadow-sm cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept Changes</span>
            </button>
          )}
        </div>
      </div>

      {/* View Mode: Normal Editor vs Split Diff View */}
      {isDiffMode ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Original / Base SEBI Version</span>
            <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">{originalText}</div>
          </div>
          <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 font-mono">Active Edited / AI Version</span>
            <div className="text-xs text-slate-900 leading-relaxed whitespace-pre-wrap font-sans font-medium">{statementText}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase font-mono tracking-wider text-slate-400 flex items-center justify-between">
            <span>Editable SEBI Forward-Looking Disclaimer Text</span>
            <span>{statementText.length} Characters</span>
          </label>
          <textarea
            value={statementText}
            onChange={(e) => { setStatementText(e.target.value); setAccepted(false); }}
            className="w-full p-4 text-xs leading-relaxed font-sans text-slate-800 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[240px] resize-y shadow-2xs"
          />
        </div>
      )}
    </div>
  );
}

/** ----------------------------------------------------
 * 16. Dynamic DRHP Block Composition Renderer
 * ---------------------------------------------------- */
export function DrhpBlockRenderer({ block, onCitationClick }) {
  if (!block) return null;

  switch (block.type) {
    case 'drhp_glossary':
      return <DrhpGlossarySection company={block.company} intake={block.intake} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'drhp_conventions':
      return <DrhpConventionsSection company={block.company} intake={block.intake} citations={block.citations} onCitationClick={onCitationClick} />;
    case 'drhp_forward_looking':
      return <DrhpForwardLookingSection company={block.company} intake={block.intake} citations={block.citations} onCitationClick={onCitationClick} />;
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


