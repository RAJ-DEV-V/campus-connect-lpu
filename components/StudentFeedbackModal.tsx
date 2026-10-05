'use client';

import React, { useState } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  BookOpen, 
  Bug, 
  MessageSquare,
  GraduationCap,
  Sparkles
} from 'lucide-react';
import { formatYearName } from '@/components/MaterialCard';

interface StudentFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'material_request' | 'bug_report';
  initialSubjectCode?: string;
  userYear?: number;
}

export default function StudentFeedbackModal({
  isOpen,
  onClose,
  defaultTab = 'material_request',
  initialSubjectCode = '',
  userYear = 1,
}: StudentFeedbackModalProps) {
  const [activeTab, setActiveTab] = useState<'material_request' | 'bug_report'>(defaultTab);

  // Material Request Form
  const [reqYear, setReqYear] = useState<number>(userYear || 1);
  const [reqSubjectCode, setReqSubjectCode] = useState(initialSubjectCode);
  const [reqSubjectName, setReqSubjectName] = useState('');
  const [reqMaterialType, setReqMaterialType] = useState('Notes');
  const [reqNote, setReqNote] = useState('');

  // Bug Report Form
  const [bugCategory, setBugCategory] = useState<'Dashboard' | 'Library' | 'Document Viewer' | 'Profile' | 'Other'>('Dashboard');
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmitMaterialRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqSubjectCode.trim()) {
      setErrorMsg('Please provide the subject code (e.g. CSE101, INT213).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'missing_subject',
          title: `Request: ${reqSubjectCode.trim().toUpperCase()} (${reqMaterialType})`,
          subject_code: reqSubjectCode.trim().toUpperCase(),
          subject_name: reqSubjectName.trim() || undefined,
          material_type: reqMaterialType,
          description: reqNote.trim() || `Student requested ${reqMaterialType} for ${reqSubjectCode.toUpperCase()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBugReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim() || !bugDescription.trim()) {
      setErrorMsg('Please enter both a title and description of the issue.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bug_report',
          title: `[${bugCategory}] ${bugTitle.trim()}`,
          description: bugDescription.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit bug report');
      }

      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setErrorMsg('');
    setReqSubjectCode('');
    setReqSubjectName('');
    setReqNote('');
    setBugTitle('');
    setBugDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white leading-tight">
                Student Support & Requests
              </h3>
              <p className="text-[11px] text-slate-400">
                Direct channel to the CampusConnect Team
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-black text-slate-900">
              {activeTab === 'material_request' ? 'Request Submitted!' : 'Bug Report Sent!'}
            </h4>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              {activeTab === 'material_request'
                ? "Thanks! The team has received your subject request and will prioritize uploading verified materials for your batch."
                : "Thank you for helping us improve CampusConnect! The admins have been notified of your report."}
            </p>
            <button
              onClick={handleResetAndClose}
              className="mt-4 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
            >
              Back to Campus
            </button>
          </div>
        ) : (
          <div>
            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => { setActiveTab('material_request'); setErrorMsg(''); }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'material_request'
                    ? 'bg-white text-orange-600 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Request Subject / Materials</span>
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('bug_report'); setErrorMsg(''); }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'bug_report'
                    ? 'bg-white text-rose-600 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bug className="w-3.5 h-3.5" />
                <span>Report a Bug / Feedback</span>
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Tab 1: Material Request */}
            {activeTab === 'material_request' && (
              <form onSubmit={handleSubmitMaterialRequest} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Year *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => setReqYear(y)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          reqYear === y
                            ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {formatYearName(y)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Subject Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={reqSubjectCode}
                      onChange={(e) => setReqSubjectCode(e.target.value.toUpperCase())}
                      placeholder="e.g. CSE205, INT213"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold uppercase text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Material Needed *
                    </label>
                    <select
                      value={reqMaterialType}
                      onChange={(e) => setReqMaterialType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500"
                    >
                      <option value="Notes">Lecture Notes</option>
                      <option value="Mid-Term">Mid-Term Papers</option>
                      <option value="End-Term">End-Term Papers</option>
                      <option value="PYQs">Previous Year Questions</option>
                      <option value="All">All Resources</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subject Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={reqSubjectName}
                    onChange={(e) => setReqSubjectName(e.target.value)}
                    placeholder="e.g. Data Structures and Algorithms"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Notes / Syllabus Details (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={reqNote}
                    onChange={(e) => setReqNote(e.target.value)}
                    placeholder="Any specific units or topics needed? e.g. Unit 3 and Unit 4 mid-term questions..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-orange-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Submitting...' : 'Send Request'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Bug Report */}
            {activeTab === 'bug_report' && (
              <form onSubmit={handleSubmitBugReport} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Where did you encounter the issue? *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Dashboard', 'Library', 'Document Viewer', 'Profile', 'Other'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setBugCategory(cat)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                          bugCategory === cat
                            ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bug Summary *
                  </label>
                  <input
                    type="text"
                    required
                    value={bugTitle}
                    onChange={(e) => setBugTitle(e.target.value)}
                    placeholder="e.g. Document preview button doesn't open on iOS Safari..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description & Steps to Reproduce *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    placeholder="Describe what happened, what device or browser you were using, and any error message you saw..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-rose-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Submitting...' : 'Report Issue'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
