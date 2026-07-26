'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Globe, Linkedin, Instagram, User, Building, ShieldAlert } from 'lucide-react';
import { useSession, useUpdateProfile, useUpdateOrg } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { Skeleton, Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

export default function ProfilePage() {
  const { data: session, isLoading } = useSession();
  const updateProfile = useUpdateProfile();
  const updateOrg = useUpdateOrg();

  const [activeTab, setActiveTab] = useState<'profile' | 'organization'>('profile');

  // Profile Form State
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [twitter, setTwitter] = useState('');
  const [instagram, setInstagram] = useState('');

  // Org Form State
  const [orgName, setOrgName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#2B3A67');

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '');
      setTitle(session.user.title || '');
      setAvatarUrl(session.user.avatarUrl || '');
      setBio(session.user.bio || '');
      setWebsite(session.user.socialLinks?.website || '');
      setLinkedin(session.user.socialLinks?.linkedin || '');
      setTwitter(session.user.socialLinks?.twitter || '');
      setInstagram(session.user.socialLinks?.instagram || '');
    }
    if (session?.org) {
      setOrgName(session.org.name || '');
      setLogoUrl(session.org.logoUrl || '');
      setBrandColor(session.org.brandColor || '#2B3A67');
    }
  }, [session]);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({
      name,
      title,
      avatarUrl,
      bio,
      socialLinks: { website, linkedin, twitter, instagram },
    });
  };

  const handleOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrg.mutate({
      name: orgName,
      logoUrl,
      brandColor,
    });
  };

  if (isLoading) {
    return (
      <div className="p-5 lg:p-7">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="hair bg-surface px-5 py-4 lg:px-7">
        <div>
          <p className="spec">Settings</p>
          <h1 className="mt-1 font-display text-2xl leading-none">Business Profile</h1>
        </div>
      </div>

      <div className="p-5 lg:p-7">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Editor Column */}
          <div className="space-y-6 lg:col-span-7">
            {/* Tabs Navigation */}
            <div className="flex border-b border-rule gap-6">
              <button
                className={cn(
                  'pb-3 text-sm font-semibold border-b-2 transition-all',
                  activeTab === 'profile'
                    ? 'border-dusk text-dusk'
                    : 'border-transparent text-ink-muted hover:text-ink'
                )}
                onClick={() => setActiveTab('profile')}
              >
                Personal Profile
              </button>
              <button
                className={cn(
                  'pb-3 text-sm font-semibold border-b-2 transition-all',
                  activeTab === 'organization'
                    ? 'border-dusk text-dusk'
                    : 'border-transparent text-ink-muted hover:text-ink'
                )}
                onClick={() => setActiveTab('organization')}
              >
                Company & Branding
              </button>
            </div>

            {/* Tab: Personal Profile */}
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full Name">
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                    />
                  </Field>
                  <Field label="Professional Title">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Founder / Senior Partner"
                    />
                  </Field>
                </div>

                <Field label="Avatar URL (Image link)">
                  <Input
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/headshot.jpg"
                  />
                  <p className="mt-1 text-[11px] text-ink-faint">
                    Use a public web link to your professional headshot picture.
                  </p>
                </Field>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-ink-muted">Bio / About Me</label>
                  <Textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief introduction displayed on your public booking page."
                    maxLength={2000}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-ink border-b border-rule pb-2">Social & Web Links</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Website">
                      <Input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://mycompany.com"
                      />
                    </Field>
                    <Field label="LinkedIn">
                      <Input
                        value={linkedin}
                        onChange={(e) => setLinkedin(e.target.value)}
                        placeholder="https://linkedin.com/in/username"
                      />
                    </Field>
                    <Field label="Twitter / X">
                      <Input
                        value={twitter}
                        onChange={(e) => setTwitter(e.target.value)}
                        placeholder="https://x.com/username"
                      />
                    </Field>
                    <Field label="Instagram">
                      <Input
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        placeholder="https://instagram.com/username"
                      />
                    </Field>
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="primary" loading={updateProfile.isPending}>
                    Save Profile Changes
                  </Button>
                </div>
              </form>
            )}

            {/* Tab: Organization */}
            {activeTab === 'organization' && (
              <form onSubmit={handleOrgSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company / Team Name">
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="My Enterprise Org"
                      required
                    />
                  </Field>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-semibold text-ink-muted">Brand Accent Color</label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="h-10 w-14 p-1 cursor-pointer"
                      />
                      <Input
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        placeholder="#2B3A67"
                        className="flex-1 font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>

                <Field label="Logo URL">
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="mt-1 text-[11px] text-ink-faint">
                    Use a public web link to your company logo (PNG or SVG formats recommended).
                  </p>
                </Field>

                <div className="pt-2">
                  <Button type="submit" variant="primary" loading={updateOrg.isPending}>
                    Save Organization Settings
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Preview Column */}
          <div className="lg:col-span-5">
            <div className="sticky top-6">
              <p className="spec mb-3 uppercase tracking-wider text-ink-faint">Live Booking Page Preview</p>
              
              <div className="card overflow-hidden shadow-sm" style={{ borderTop: `4px solid ${brandColor}` }}>
                {/* Org Logo Header */}
                <div className="px-6 py-4 border-b border-rule bg-white flex items-center justify-between">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-6 max-w-[120px] object-contain shrink-0" />
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: brandColor }} />
                      <span className="font-sans text-sm font-semibold tracking-wide text-ink-strong truncate max-w-[180px]">
                        {orgName || 'Longitude Studio'}
                      </span>
                    </div>
                  )}
                  <span className="text-[11px] font-mono text-ink-faint shrink-0">Public Page</span>
                </div>

                {/* Profile Detail */}
                <div className="p-6 bg-chalk/30 space-y-4">
                  <div className="flex items-center gap-4">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={name}
                        className="h-16 w-16 rounded-full object-cover border border-rule-strong"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150';
                        }}
                      />
                    ) : (
                      <Avatar name={name || 'User'} color="dusk" size="md" className="h-16 w-16 text-lg" />
                    )}
                    <div>
                      <h2 className="font-display text-xl leading-tight text-ink">{name || 'Your Name'}</h2>
                      {title && <p className="text-[13px] font-medium text-ink-muted mt-0.5">{title}</p>}
                    </div>
                  </div>

                  {bio ? (
                    <p className="text-[13px] text-ink-muted leading-relaxed whitespace-pre-wrap">{bio}</p>
                  ) : (
                    <p className="text-[13px] text-ink-faint italic leading-relaxed">
                      No bio written yet. Fill out the form to describe yourself or your team.
                    </p>
                  )}

                  {/* Social Buttons */}
                  <div className="flex items-center gap-4 pt-3 border-t border-rule">
                    {website && (
                      <a href={website} target="_blank" rel="noreferrer" className="text-ink-muted hover:text-ink transition-colors" title="Website">
                        <Globe className="h-4 w-4" />
                      </a>
                    )}
                    {linkedin && (
                      <a href={linkedin} target="_blank" rel="noreferrer" className="text-ink-muted hover:text-ink transition-colors" title="LinkedIn">
                        <Linkedin className="h-4 w-4" />
                      </a>
                    )}
                    {twitter && (
                      <a href={twitter} target="_blank" rel="noreferrer" className="text-ink-muted hover:text-ink transition-colors" title="X (Twitter)">
                        <XIcon className="h-4 w-4" />
                      </a>
                    )}
                    {instagram && (
                      <a href={instagram} target="_blank" rel="noreferrer" className="text-ink-muted hover:text-ink transition-colors" title="Instagram">
                        <Instagram className="h-4 w-4" />
                      </a>
                    )}
                    {!website && !linkedin && !twitter && !instagram && (
                      <span className="text-[11px] font-mono text-ink-faint">No social links configured</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}