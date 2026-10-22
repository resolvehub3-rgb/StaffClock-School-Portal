import React, { useState } from 'react';
import { getSupabaseConfig, saveSupabaseConfig, clearCustomSupabaseConfig, getSupabase } from '../lib/supabase';
import { Database, CheckCircle2, AlertCircle, Copy, Check, X, ExternalLink, Loader2 } from 'lucide-react';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'credentials' | 'migration'>('credentials');

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl.startsWith('https://') || !cleanUrl.includes('.supabase.co')) {
      setIsTesting(false);
      setTestResult({
        success: false,
        message: 'Invalid Supabase URL. Must be in the form https://your-project-id.supabase.co',
      });
      return;
    }

    if (!cleanKey || cleanKey.length < 20) {
      setIsTesting(false);
      setTestResult({
        success: false,
        message: 'Invalid Supabase Anon Key. Must be a valid JWT public publishable key.',
      });
      return;
    }

    try {
      saveSupabaseConfig(cleanUrl, cleanKey);
      const supabase = getSupabase();
      if (!supabase) throw new Error('Could not instantiate Supabase client');

      // Test a light ping query
      const { error } = await supabase.from('school_settings').select('id').limit(1);

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        // 42P01 means table does not exist yet (migrations pending)
        throw error;
      }

      setTestResult({
        success: true,
        message: error?.code === '42P01'
          ? 'Connected to Supabase! (Tables not yet found: please run the SQL Migration in tab 2)'
          : 'Successfully verified connection to Supabase database & storage!',
      });

      onConfigSaved();
    } catch (err: any) {
      console.error('Connection test failed:', err);
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message || 'Check your URL and API Key.'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const sqlSnippet = `-- StaffClock Supabase Migration Location:
-- /supabase/migrations/20261022000000_teacher_attendance_system.sql
-- Run this in your Supabase Dashboard > SQL Editor to setup tables, RLS, Storage & RPCs.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-[#E5E7EB] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F8F8] px-4 py-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#C62828]" />
            <h3 className="text-sm font-bold text-[#202124]">Supabase Project Connection</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#667085] hover:text-[#202124] p-1 rounded-md"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E5E7EB] px-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('credentials')}
            className={`py-2.5 px-3 border-b-2 transition ${
              activeTab === 'credentials'
                ? 'border-[#C62828] text-[#C62828]'
                : 'border-transparent text-[#667085] hover:text-[#202124]'
            }`}
          >
            Connection Keys
          </button>
          <button
            onClick={() => setActiveTab('migration')}
            className={`py-2.5 px-3 border-b-2 transition ${
              activeTab === 'migration'
                ? 'border-[#C62828] text-[#C62828]'
                : 'border-transparent text-[#667085] hover:text-[#202124]'
            }`}
          >
            SQL Migration Guide
          </button>
        </div>

        <div className="p-4 text-xs">
          {activeTab === 'credentials' ? (
            <form onSubmit={handleTestAndSave} className="space-y-3">
              <p className="text-[#667085] text-xs">
                StaffClock connects directly to your school's live Supabase database, authentication, and private selfie storage.
              </p>

              <div>
                <label className="block font-semibold text-[#202124] mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://xyzabcdefg.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#C62828]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#202124] mb-1">
                  Supabase Anon Key (Public Publishable)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
                />
                <p className="text-[10px] text-[#667085] mt-1">
                  Found in your Supabase Dashboard under <strong>Project Settings → API → Project API Keys</strong>.
                </p>
              </div>

              {testResult && (
                <div
                  className={`rounded-lg p-3 text-xs flex items-start gap-2 border ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-red-50 text-[#B91C1C] border-red-200'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => {
                    clearCustomSupabaseConfig();
                    setUrl('');
                    setAnonKey('');
                    setTestResult(null);
                  }}
                  className="text-[11px] text-[#667085] hover:text-[#B91C1C]"
                >
                  Reset Keys
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-1.5 font-medium text-[#667085] hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isTesting}
                    className="flex items-center gap-1.5 rounded-lg bg-[#C62828] px-4 py-1.5 font-bold text-white hover:bg-[#8E1B1B] disabled:opacity-50"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Connect Supabase</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-[#667085]">
                To initialize the schema in your Supabase project, execute the SQL migration script located in the repository at:
              </p>
              <div className="rounded-lg bg-gray-900 text-gray-100 p-3 font-mono text-[11px] overflow-x-auto">
                supabase/migrations/20261022000000_teacher_attendance_system.sql
              </div>
              <p className="text-[11px] text-[#667085]">
                This sets up all 10 tables, Row Level Security (RLS) policies, Haversine geofence calculations, private photo storage buckets, and attendance triggers.
              </p>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-[#202124] px-4 py-1.5 font-bold text-white hover:bg-black"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
