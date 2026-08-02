import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMerchantBankers, createInvitation, getInvitations, acceptInvitation, declineInvitation, revokeInvitation, resendInvitation } from '../services/api';
import { Search, Send, Clock, CheckCircle, XCircle, Building2, ExternalLink, RotateCcw, Ban, ArrowRight, Mail, Inbox } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function InvitationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bankers, setBankers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviting, setInviting] = useState(null);
  const [actioning, setActioning] = useState(null);
  const [error, setError] = useState(null);

  const isIssuer = user?.role === 'issuer';
  const isReviewer = user?.role === 'reviewer';

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (isIssuer) {
        const [bankersRes, invitesRes] = await Promise.all([
          getMerchantBankers(),
          getInvitations()
        ]);
        setBankers(bankersRes.data?.merchant_bankers || bankersRes.data || []);
        setInvitations(Array.isArray(invitesRes.data) ? invitesRes.data : []);
      } else {
        // Reviewer: only load invitations for them
        const invitesRes = await getInvitations();
        setInvitations(Array.isArray(invitesRes.data) ? invitesRes.data : []);
      }
    } catch (err) {
      console.error('Failed to load invitations data:', err);
      setError('Could not load data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      const res = await getMerchantBankers(searchQuery);
      setBankers(res.data?.merchant_bankers || res.data || []);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleInvite = async (banker) => {
    try {
      setInviting(banker.id);
      await createInvitation({
        merchant_banker_id: banker.id,
        merchant_banker_name: banker.name,
        message: 'We would like to invite you to review our IPO draft document on IPO Pilot AI.'
      });
      await loadData();
    } catch (err) {
      console.error('Failed to send invite:', err);
      alert('Failed to send invite. Please try again.');
    } finally {
      setInviting(null);
    }
  };

  const handleAccept = async (invId) => {
    try {
      setActioning(invId);
      await acceptInvitation(invId);
      await loadData();
    } catch (err) {
      console.error('Accept failed:', err);
    } finally {
      setActioning(null);
    }
  };

  const handleDecline = async (invId) => {
    try {
      setActioning(invId);
      await declineInvitation(invId);
      await loadData();
    } catch (err) {
      console.error('Decline failed:', err);
    } finally {
      setActioning(null);
    }
  };

  const handleRevoke = async (invId) => {
    try {
      setActioning(invId);
      await revokeInvitation(invId);
      await loadData();
    } catch (err) {
      console.error('Revoke failed:', err);
    } finally {
      setActioning(null);
    }
  };

  const handleResend = async (invId) => {
    try {
      setActioning(invId);
      await resendInvitation(invId);
      await loadData();
    } catch (err) {
      console.error('Resend failed:', err);
    } finally {
      setActioning(null);
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'accepted': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'declined': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'revoked': return <Ban className="w-4 h-4 text-slate-400" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'accepted': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'declined': return 'bg-red-50 text-red-700 border-red-200';
      case 'revoked': return 'bg-slate-50 text-slate-500 border-slate-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Clock className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-slate-500 text-sm">Loading invitations...</p>
        </div>
      </div>
    );
  }

  // ─── REVIEWER VIEW: See received invitations only ─────────────────────────
  if (isReviewer) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Page header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">My Invitations</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Review invitations from SME companies requesting your merchant banker certification
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>
        )}

        {invitations.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-slate-600 font-semibold text-lg mb-1">No Invitations Yet</h3>
            <p className="text-slate-400 text-sm">
              When a company invites you to review their IPO draft, the invitation will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {invitations.map(inv => (
              <div key={inv.id} className={`bg-white p-6 rounded-2xl border shadow-sm ${inv.status === 'accepted' ? 'border-emerald-200' : inv.status === 'declined' ? 'border-red-200' : 'border-indigo-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${inv.status === 'accepted' ? 'bg-emerald-50' : inv.status === 'declined' ? 'bg-red-50' : 'bg-indigo-50'}`}>
                      <Mail className={`w-5 h-5 ${inv.status === 'accepted' ? 'text-emerald-600' : inv.status === 'declined' ? 'text-red-500' : 'text-indigo-600'}`} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{inv.company_name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Invited by: {inv.invited_by_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Sent: {new Date(inv.created_at || inv.invited_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {inv.expires_at && ` · Expires: ${new Date(inv.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </p>
                      {inv.message && (
                        <p className="text-xs text-slate-600 mt-2 italic border-l-2 border-slate-200 pl-2">{inv.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getStatusColor(inv.status)}`}>
                      {getStatusIcon(inv.status)}
                      {inv.status}
                    </span>

                    <div className="flex items-center gap-2">
                      {inv.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAccept(inv.id)}
                            disabled={actioning === inv.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Accept
                          </button>
                          <button
                            onClick={() => handleDecline(inv.id)}
                            disabled={actioning === inv.id}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Decline
                          </button>
                        </>
                      )}
                      {inv.status === 'accepted' && (
                        <button
                          onClick={() => {
                            localStorage.setItem('ipo_company_id', inv.company_id || 'aarav-precision');
                            navigate('/reviewer-workspace');
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          Open Workspace <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {inv.responded_at && inv.status !== 'pending' && (
                  <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
                    {inv.status === 'accepted' ? 'Accepted' : inv.status === 'declined' ? 'Declined' : 'Responded'} on:{' '}
                    {new Date(inv.responded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── ISSUER VIEW: Search bankers + send invitations ───────────────────────
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Merchant Banker Invitations</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Invite SEBI-registered Merchant Bankers to review and certify your draft prospectus
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>
      )}

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Search & List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">SEBI-Registered Merchant Bankers</h3>
            
            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, registration number, or location..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                />
              </div>
              <button type="submit" className="btn-primary py-2.5 px-6 shrink-0 shadow-sm rounded-xl">
                Search
              </button>
            </form>

            <div className="space-y-4">
              {bankers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm">No merchant bankers found.</p>
                </div>
              ) : (
                bankers.map(banker => {
                  const invite = invitations.find(i => i.merchant_banker_id === banker.id && i.status !== 'revoked');
                  return (
                    <div key={banker.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          {banker.name}
                          <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                            {banker.category || 'Category I'}
                          </span>
                        </h4>
                        <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                          <p><span className="font-medium text-slate-600">Reg No:</span> {banker.registration_no}</p>
                          {banker.address && <p><span className="font-medium text-slate-600">Address:</span> {banker.address}</p>}
                        </div>
                      </div>
                      <div>
                        {invite ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getStatusColor(invite.status)}`}>
                              {getStatusIcon(invite.status)}
                              {invite.status}
                            </span>
                            {invite.status === 'pending' && (
                              <button
                                onClick={() => handleRevoke(invite.id)}
                                disabled={actioning === invite.id}
                                className="text-[10px] text-slate-500 hover:text-red-600 font-medium transition-colors flex items-center gap-0.5"
                              >
                                <Ban className="w-3 h-3" /> Revoke
                              </button>
                            )}
                            {(invite.status === 'declined' || invite.status === 'expired') && (
                              <button
                                onClick={() => handleResend(invite.id)}
                                disabled={actioning === invite.id}
                                className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium transition-colors flex items-center gap-0.5"
                              >
                                <RotateCcw className="w-3 h-3" /> Resend
                              </button>
                            )}
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleInvite(banker)}
                            disabled={inviting === banker.id}
                            className="btn-secondary py-1.5 px-4 text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {inviting === banker.id ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Send Invite
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">
                Data sourced from official SEBI registration records.
              </p>
              <a href="https://www.sebi.gov.in/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-indigo-500 hover:underline">
                Verify on SEBI <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Sent Invitations Status */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm h-full max-h-[800px] flex flex-col">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-indigo-500" />
              Sent Invitations ({invitations.length})
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {invitations.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Send className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs">No invitations sent yet.</p>
                  <p className="text-slate-400 text-[11px] mt-1">Select a merchant banker from the list to invite them.</p>
                </div>
              ) : (
                invitations.map(inv => (
                  <div key={inv.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-bold text-xs text-slate-800 line-clamp-1" title={inv.merchant_banker_name}>
                        {inv.merchant_banker_name}
                      </h5>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                        {new Date(inv.created_at || inv.invited_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/50">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(inv.status)}`}>
                        {getStatusIcon(inv.status)}
                        {inv.status}
                      </span>
                      <div className="flex items-center gap-1">
                        {inv.status === 'pending' && (
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            disabled={actioning === inv.id}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-medium transition-colors"
                          >
                            Revoke
                          </button>
                        )}
                        {(inv.status === 'revoked' || inv.status === 'declined' || inv.status === 'expired') && (
                          <button
                            onClick={() => handleResend(inv.id)}
                            disabled={actioning === inv.id}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[10px] font-medium transition-colors flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Resend
                          </button>
                        )}
                        {inv.status === 'accepted' && (
                          <span className="text-[10px] text-emerald-600 font-semibold">✓ Active</span>
                        )}
                      </div>
                    </div>
                    {inv.status === 'accepted' && inv.responded_at && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Accepted: {new Date(inv.responded_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
