/**
 * Profile Form Page
 *
 * Unified form for adding ZoneMinder server profiles.
 * Used for both initial setup (when no profiles exist) and adding additional profiles.
 * Shows welcome messaging when this is the user's first profile.
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { useProfileStore } from '../stores/profile';
import { createApiClient, setApiClient } from '../api/client';
import { discoverZoneminder, DiscoveryError } from '../lib/discovery';
import { Switch } from '../components/ui/switch';
import { Video, Server, ShieldCheck, ArrowRight, Loader2, Eye, EyeOff, ArrowLeft, QrCode, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { log, LogLevel } from '../lib/logger';
import { fetchGo2RTCPath } from '../api/auth';
import { QRScanner } from '../components/QRScanner';
import { parseQRProfile } from '../lib/qr-profile';
import { toast } from 'sonner';
import { CertTrustDialog } from '../components/CertTrustDialog';
import { Platform } from '../lib/platform';
import type { CertInfo } from '../lib/ssl-trust';

export default function ProfileForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const addProfile = useProfileStore((state) => state.addProfile);
  const profiles = useProfileStore((state) => state.profiles);

  // Check if this is the first profile (initial setup)
  const isFirstProfile = profiles.length === 0;
  const returnTo = searchParams.get('returnTo') || '/monitors';

  // Default to demo server only for first profile
  const [profileName, setProfileName] = useState('');
  const [portalUrl, setPortalUrl] = useState(isFirstProfile ? 'https://demo.zoneminder.com' : '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Manual URL entry mode
  const [showManualUrls, setShowManualUrls] = useState(false);
  const [manualApiUrl, setManualApiUrl] = useState('');
  const [manualCgiUrl, setManualCgiUrl] = useState('');

  // Self-signed certificate support
  const [allowSelfSignedCerts, setAllowSelfSignedCerts] = useState(false);

  // TOFU cert trust dialog state
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
  const certResolveRef = useRef<((trusted: boolean) => void) | null>(null);

  // Show the TOFU dialog and wait for user to trust or reject
  const requestCertTrust = useCallback((info: CertInfo): Promise<boolean> => {
    return new Promise((resolve) => {
      setCertInfo(info);
      setCertDialogOpen(true);
      certResolveRef.current = resolve;
    });
  }, []);

  const handleCertTrust = useCallback(() => {
    setCertDialogOpen(false);
    certResolveRef.current?.(true);
    certResolveRef.current = null;
  }, []);

  const handleCertCancel = useCallback(() => {
    setCertDialogOpen(false);
    certResolveRef.current?.(false);
    certResolveRef.current = null;
  }, []);

  // QR Scanner state
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Abort controller for cancelling discovery
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle QR code scan result
  const handleQRScan = (data: string) => {
    const result = parseQRProfile(data);

    if (!result.success) {
      log.profileForm('QR profile parse failed', LogLevel.WARN, { error: result.error });
      toast.error(t(`qr_scanner.parse_errors.${result.error}`));
      return;
    }

    log.profileForm('QR profile imported', LogLevel.INFO, { name: result.data.name });

    // Pre-fill form fields with scanned data
    setProfileName(result.data.name);
    setPortalUrl(result.data.portalUrl);
    if (result.data.username) setUsername(result.data.username);
    if (result.data.password) setPassword(result.data.password);

    // If manual URLs were provided in QR, enable manual mode
    if (result.data.apiUrl || result.data.cgiUrl) {
      setShowManualUrls(true);
      if (result.data.apiUrl) setManualApiUrl(result.data.apiUrl);
      if (result.data.cgiUrl) setManualCgiUrl(result.data.cgiUrl);
    }

    toast.success(t('qr_scanner.import_success', { name: result.data.name }));
  };

  // Discover API and CGI URLs from portal URL
  // If credentials are provided, also authenticates to fetch ZM_PATH_ZMS for accurate cgiUrl
  // Retries once on network failure to handle iOS local network permission dialog race condition
  const discoverUrls = async (portal: string, credentials?: { username: string; password: string }, signal?: AbortSignal) => {
    const attempt = async () => {
      const result = await discoverZoneminder(portal, { ...credentials, signal });
      const client = createApiClient(result.apiUrl);
      setApiClient(client);
      log.profileForm('Successfully connected', LogLevel.INFO, { apiUrl: result.apiUrl });
      return result;
    };

    try {
      return await attempt();
    } catch (e) {
      // On network-related failures, retry once after a delay.
      // This handles the iOS local network permission dialog: the first request
      // fails while the dialog is showing, but succeeds after the user grants access.
      if (e instanceof DiscoveryError && (e.code === 'API_NOT_FOUND' || e.code === 'PORTAL_UNREACHABLE')) {
        log.profileForm('First discovery attempt failed, retrying in case of iOS permission dialog', LogLevel.INFO);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        if (signal?.aborted) {
          throw new DiscoveryError('Discovery cancelled', 'CANCELLED');
        }
        try {
          return await attempt();
        } catch (retryError) {
          if (retryError instanceof DiscoveryError) {
            throw retryError;
          }
          throw new Error(t('setup.discovery_failed'));
        }
      }
      if (e instanceof DiscoveryError) {
        throw e;
      }
      throw new Error(t('setup.discovery_failed'));
    }
  };

  // Cancel ongoing discovery
  const handleCancelDiscovery = () => {
    if (abortControllerRef.current) {
      log.profileForm('Cancelling discovery', LogLevel.INFO);
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setTesting(false);
    setError('');
  };

  const handleTestConnection = async () => {
    setError('');
    setSuccess(false);
    setTesting(true);

    // Create abort controller for this connection attempt
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Enable trust-all for HTTP before any network calls (needed for discovery)
      if (allowSelfSignedCerts) {
        const { applySSLTrustSetting } = await import('../lib/ssl-trust');
        await applySSLTrustSetting(true);
      }

      const normalizedUsername = username.trim();
      const hasUsername = normalizedUsername.length > 0;
      const hasPassword = password.length > 0;

      if ((hasUsername && !hasPassword) || (hasPassword && !hasUsername)) {
        throw new Error(t('setup.credentials_incomplete'));
      }

      log.profileForm('Testing connection', LogLevel.INFO, { portalUrl });

      let confirmedPortalUrl: string;
      let apiUrl: string;
      let cgiUrl: string;
      let go2rtcPath: string | null = null;
      let acceptedFingerprint: string | null = null;

      if (showManualUrls) {
        // Manual URL entry mode
        log.profileForm('Using manual URLs', LogLevel.INFO);
        if (!manualApiUrl || !manualCgiUrl) {
          throw new Error(t('setup.enter_both_urls'));
        }

        // Validate that portal and API have matching protocols
        const portalHasProtocol = portalUrl.startsWith('http://') || portalUrl.startsWith('https://');
        const portalProtocol = portalUrl.startsWith('https://') ? 'https' : 'http';
        const apiHasProtocol = manualApiUrl.startsWith('http://') || manualApiUrl.startsWith('https://');
        const apiProtocol = manualApiUrl.startsWith('https://') ? 'https' : 'http';

        if (portalHasProtocol && apiHasProtocol && portalProtocol !== apiProtocol) {
          throw new Error(
            `Protocol mismatch! Portal uses ${portalProtocol}:// but API uses ${apiProtocol}://. ` +
            `Both must use the same protocol (either both HTTP or both HTTPS).`
          );
        }

        // Ensure portal URL has protocol for manual mode
        confirmedPortalUrl = portalUrl;
        if (!confirmedPortalUrl.startsWith('http://') && !confirmedPortalUrl.startsWith('https://')) {
          confirmedPortalUrl = `https://${confirmedPortalUrl}`;
        }

        apiUrl = manualApiUrl;
        cgiUrl = manualCgiUrl;
        log.profileForm('Manual URLs set', LogLevel.INFO, { portalUrl: confirmedPortalUrl, apiUrl, cgiUrl });

        // Initialize API client with manual URL
        const client = createApiClient(apiUrl);
        setApiClient(client);
      } else {
        // Discover URLs from portal URL
        // Pass credentials if provided to fetch accurate ZM_PATH_ZMS from server
        log.profileForm('Discovering URLs', LogLevel.INFO);
        const credentials = hasUsername && hasPassword ? { username: normalizedUsername, password } : undefined;
        const discovered = await discoverUrls(portalUrl, credentials, signal);
        confirmedPortalUrl = discovered.portalUrl;
        apiUrl = discovered.apiUrl;
        cgiUrl = discovered.cgiUrl;
        log.profileForm('URLs discovered', LogLevel.INFO, { portalUrl: confirmedPortalUrl, apiUrl, cgiUrl });
      }

      // TOFU: after discovery succeeds, fetch the server cert and ask user to trust it
      if (allowSelfSignedCerts && Platform.isNative) {
        const { getServerCertFingerprint, applySSLTrustSetting } = await import('../lib/ssl-trust');
        const info = await getServerCertFingerprint(confirmedPortalUrl);
        if (info) {
          const trusted = await requestCertTrust(info);
          if (!trusted) {
            await applySSLTrustSetting(false);
            setTesting(false);
            return;
          }
          // Save to local var (React state update from handleCertTrust is batched
          // and won't be available until next render)
          acceptedFingerprint = info.fingerprint;
          // Apply fingerprint-based trust (installs WebView handler)
          await applySSLTrustSetting(true, acceptedFingerprint);
        }
      }

      // If credentials are provided, try to login
      if (normalizedUsername && hasPassword) {
        log.profileForm('Attempting login with provided credentials', LogLevel.INFO, { username: normalizedUsername });
        try {
          const { useAuthStore } = await import('../stores/auth');

          // Clear any existing auth state to ensure clean login
          // This prevents old tokens from interfering with new profile login
          useAuthStore.getState().logout();
          log.profileForm('Cleared existing auth state for fresh login', LogLevel.DEBUG);

          await useAuthStore.getState().login(normalizedUsername, password);
          log.profileForm('Login successful', LogLevel.INFO);

          // Note: ZMS path is already fetched during discovery when credentials are provided,
          // so cgiUrl is already set correctly. We just need to fetch Go2RTC path here.

          // Fetch Go2RTC path if configured (optional, not all servers have it)
          go2rtcPath = await fetchGo2RTCPath();
          if (go2rtcPath) {
            log.profileForm('Go2RTC path fetched from server config', LogLevel.INFO, {
              go2rtcPath
            });
          } else {
            log.profileForm('Go2RTC not configured on server', LogLevel.INFO);
          }
        } catch (loginError: unknown) {
          log.profileForm('Login failed', LogLevel.ERROR, loginError);
          throw new Error(t('setup.login_failed', { error: (loginError as Error).message || 'Unknown error' }));
        }
      }

      setSuccess(true);
      setError('');

      // Generate profile name if not provided
      const finalProfileName = profileName.trim() || (
        confirmedPortalUrl.includes('demo.zoneminder.com')
          ? 'Demo Server'
          : confirmedPortalUrl.includes('isaac')
            ? 'Isaac Server'
            : 'My ZoneMinder'
      );

      log.profileForm('Adding new profile', LogLevel.INFO, { profileName: finalProfileName });
      const newProfileId = await addProfile({
        name: finalProfileName,
        portalUrl: confirmedPortalUrl,
        apiUrl,
        cgiUrl,
        username: normalizedUsername || undefined,
        password: password || undefined,
        isDefault: isFirstProfile,
        go2rtcUrl: go2rtcPath || undefined,
      });
      log.profileForm('Profile created', LogLevel.INFO, { profileName: finalProfileName, profileId: newProfileId });

      // Save self-signed cert setting and trusted fingerprint to the new profile
      if (allowSelfSignedCerts) {
        const { useSettingsStore } = await import('../stores/settings');
        useSettingsStore.getState().updateProfileSettings(newProfileId, {
          allowSelfSignedCerts: true,
          trustedCertFingerprint: acceptedFingerprint,
        });
      }

      // Switch to the newly created profile (unless it's the first profile, which is auto-set as current)
      if (!isFirstProfile) {
        const switchProfile = useProfileStore.getState().switchProfile;
        log.profileForm('Switching to newly created profile', LogLevel.INFO, { profileId: newProfileId });
        await switchProfile(newProfileId);
      }

      // Navigate after a short delay
      setTimeout(() => {
        navigate(returnTo);
      }, 1000);
    } catch (err: unknown) {
      // Don't show error if cancelled by user
      if (err instanceof DiscoveryError && err.code === 'CANCELLED') {
        log.profileForm('Discovery cancelled by user', LogLevel.INFO);
        return;
      }
      setError((err as Error).message || t('setup.connection_failed'));
      setSuccess(false);
    } finally {
      abortControllerRef.current = null;
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-y-auto p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50 animate-pulse" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl opacity-50" />

      <Card className="w-full max-w-md border-border/50 shadow-2xl backdrop-blur-xl bg-card/80 z-10">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-primary/20">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isFirstProfile ? t('setup.welcome') : t('profiles.add_dialog_title')}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {isFirstProfile ? t('setup.subtitle') : t('profiles.add_dialog_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Import Button */}
          <Button
            variant="outline"
            onClick={() => setShowQRScanner(true)}
            className="w-full"
            data-testid="qr-import-button"
          >
            <QrCode className="mr-2 h-4 w-4" />
            {t('qr_scanner.import_button')}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {t('qr_scanner.or_manual')}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profileName" className="text-sm font-medium">{t('setup.profile_name')}</Label>
            <Input
              id="profileName"
              type="text"
              placeholder={t('setup.profile_name_placeholder')}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              disabled={testing}
              className="h-10 bg-background/50 border-input/50 focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="portal" className="text-sm font-medium">{t('setup.server_url')}</Label>
            <div className="relative">
              <Server className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="portal"
                type="text"
                placeholder="https://demo.zoneminder.com"
                value={portalUrl}
                onChange={(e) => setPortalUrl(e.target.value)}
                disabled={testing}
                className="h-10 pl-10 bg-background/50 border-input/50 focus:border-primary/50 transition-colors"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('setup.server_url_hint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">{t('setup.username')}</Label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                placeholder={t('setup.username_placeholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={testing}
                className="h-10 pl-10 bg-background/50 border-input/50 focus:border-primary/50 transition-colors"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">{t('setup.password')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword || !password ? 'text' : 'password'}
                placeholder={t('setup.password_placeholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={testing}
                className="h-10 pr-10 bg-background/50 border-input/50 focus:border-primary/50 transition-colors"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="new-password"
              />
              {password && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('setup.credentials_optional')}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="self-signed-certs" className="text-sm text-muted-foreground cursor-pointer">
              {t('settings.allow_self_signed_certs')}
            </Label>
            <Switch
              id="self-signed-certs"
              checked={allowSelfSignedCerts}
              onCheckedChange={setAllowSelfSignedCerts}
              data-testid="setup-self-signed-certs-switch"
            />
          </div>

          {/* Manual URL Entry Toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowManualUrls(!showManualUrls)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showManualUrls ? t('setup.use_auto_discovery') : t('setup.manual_urls')}
            </button>
          </div>

          {showManualUrls && (
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <Label htmlFor="apiUrl" className="text-sm font-medium">{t('setup.api_url')}</Label>
                <Input
                  id="apiUrl"
                  type="text"
                  placeholder="http://example.com/zm/api"
                  value={manualApiUrl}
                  onChange={(e) => setManualApiUrl(e.target.value)}
                  disabled={testing}
                  className="h-10 bg-background/50 border-input/50 focus:border-primary/50 transition-colors font-mono text-sm"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cgiUrl" className="text-sm font-medium">{t('setup.cgi_url')}</Label>
                <Input
                  id="cgiUrl"
                  type="text"
                  placeholder="http://example.com/zm/cgi-bin"
                  value={manualCgiUrl}
                  onChange={(e) => setManualCgiUrl(e.target.value)}
                  disabled={testing}
                  className="h-10 bg-background/50 border-input/50 focus:border-primary/50 transition-colors font-mono text-sm"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-600 dark:text-green-400">
              {t('setup.success')}
            </div>
          )}

          {testing && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('setup.testing')}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {testing ? (
            <Button
              variant="destructive"
              onClick={handleCancelDiscovery}
              className="w-full h-11 text-base font-medium"
              data-testid="cancel-discovery-button"
            >
              <X className="mr-2 h-4 w-4" />
              {t('common.cancel')}
            </Button>
          ) : (
            <Button
              onClick={handleTestConnection}
              disabled={!portalUrl}
              className="w-full h-11 text-base font-medium shadow-lg shadow-primary/20"
              data-testid="connect-button"
            >
              {isFirstProfile ? t('setup.connect') : t('profiles.add')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {!isFirstProfile && !testing && (
            <Button
              variant="outline"
              onClick={() => navigate('/profiles')}
              disabled={testing}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('common.cancel')}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* QR Scanner Dialog */}
      <QRScanner
        open={showQRScanner}
        onOpenChange={setShowQRScanner}
        onScan={handleQRScan}
      />

      {/* TOFU Certificate Trust Dialog */}
      <CertTrustDialog
        open={certDialogOpen}
        certInfo={certInfo}
        isChanged={false}
        onTrust={handleCertTrust}
        onCancel={handleCertCancel}
      />
    </div>
  );
}
