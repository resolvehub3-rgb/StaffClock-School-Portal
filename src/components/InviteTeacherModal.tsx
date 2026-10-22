import React, { useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { UserPlus, Copy, Check, X, Link, Mail, Loader2 } from 'lucide-react';
import { SchoolClass } from '../types/database';

interface InviteTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  onTeacherInvited: () => void;
}

export const InviteTeacherModal: React.FC<InviteTeacherModalProps> = ({
  isOpen,
  onClose,
  classes,
  onTeacherInvited,
}) => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [staffNumber, setStaffNumber] = useState('');
  const [classId, setClassId] = useState('');
  const [role, setRole] = useState<'teacher' | 'headmaster'>('teacher');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Generate high-entropy token
      const token = (Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)).toUpperCase();

      const { data, error } = await supabase
        .from('teacher_invitations')
        .insert({
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          staff_number: staffNumber.trim().toUpperCase(),
          role,
          class_id: classId || null,
          token,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Build the manual shareable invite activation link
      const inviteUrl = `${window.location.origin}/?activate=${token}`;
      setGeneratedInviteLink(inviteUrl);
      onTeacherInvited();
    } catch (err: any) {
      console.error('Invite error:', err);
      setErrorMsg(err.message || 'Failed to generate teacher invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedInviteLink) {
      navigator.clipboard.writeText(generatedInviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleReset = () => {
    setEmail('');
    setFullName('');
    setStaffNumber('');
    setClassId('');
    setRole('teacher');
    setGeneratedInviteLink(null);
    setCopied(false);
    setErrorMsg(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F8F8] px-4 py-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#C62828]" />
            <h3 className="text-sm font-bold text-[#202124]">
              {generatedInviteLink ? 'Teacher Activation Link Ready' : 'Invite Staff Member'}
            </h3>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="text-[#667085] hover:text-[#202124] p-1 rounded-md"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 text-xs">
          {generatedInviteLink ? (
            <div className="space-y-3.5">
              <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-center">
                <Check className="mx-auto w-8 h-8 text-emerald-600 mb-1" />
                <h4 className="text-sm font-bold text-emerald-900">Invitation Generated Successfully!</h4>
                <p className="text-xs text-emerald-700 mt-1">
                  Copy and send this activation link manually to <strong>{fullName}</strong> ({email}) via email, SMS, or WhatsApp.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#202124] mb-1">
                  Manual Activation Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 py-2 text-[#202124] text-[11px] font-mono select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 rounded-lg bg-[#C62828] px-3.5 py-2 font-bold text-white hover:bg-[#8E1B1B] transition whitespace-nowrap"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-[#667085] mt-1.5">
                  The teacher can click this link anytime (during or after school hours) to activate their account and set their password.
                </p>
              </div>

              <div className="flex justify-between pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-1.5 font-medium text-[#202124] hover:bg-gray-50"
                >
                  Invite Another Staff
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  className="rounded-lg bg-[#202124] px-4 py-1.5 font-bold text-white hover:bg-black"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-[#202124] mb-1">
                  Full Name <span className="text-[#C62828]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Samuel K. Mensah"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">
                    Email Address <span className="text-[#C62828]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@school.edu.gh"
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">
                    Staff ID Number <span className="text-[#C62828]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={staffNumber}
                    onChange={(e) => setStaffNumber(e.target.value)}
                    placeholder="e.g. TCH-042"
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">System Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
                  >
                    <option value="teacher">Teacher</option>
                    <option value="headmaster">Headmaster</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Primary Class</label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
                  >
                    <option value="">-- Unassigned / Subject --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name} ({c.class_level})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs font-semibold text-[#B91C1C]">{errorMsg}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-1.5 font-medium text-[#667085] hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-[#C62828] px-4 py-1.5 font-bold text-white hover:bg-[#8E1B1B] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Link...</span>
                    </>
                  ) : (
                    <>
                      <Link className="w-3.5 h-3.5" />
                      <span>Create Invitation & Link</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
