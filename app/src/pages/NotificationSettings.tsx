/**
 * Notification Settings Page
 *
 * Configures notification preferences, including server connection,
 * monitor filters, and push notification settings.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../stores/notifications';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useProfileStore } from '../stores/profile';
import { getMonitors } from '../api/monitors';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  Bell,
  BellOff,
  Wifi,
  WifiOff,
  Server,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Platform } from '../lib/platform';
import { useTranslation } from 'react-i18next';
import { log, LogLevel } from '../lib/logger';
import { checkNotificationsApiSupport } from '../api/notifications';
import { getEventPoller } from '../services/eventPoller';
import type { NotificationMode } from '../types/notifications';

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentProfile } = useCurrentProfile();
  const getDecryptedPassword = useProfileStore((state) => state.getDecryptedPassword);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const {
    getProfileSettings,
    updateProfileSettings,
    setMonitorFilter,
    connect,
    disconnect,
    connectionState,
    isConnected,
    getUnreadCount,
  } = useNotificationStore();

  // Get settings for current profile
  const settings = currentProfile ? getProfileSettings(currentProfile.id) : null;
  const unreadCount = currentProfile ? getUnreadCount(currentProfile.id) : 0;

  // Fetch monitors
  const { data: monitorsData } = useQuery({
    queryKey: ['monitors', currentProfile?.id],
    queryFn: getMonitors,
    enabled: !!currentProfile && isAuthenticated,
  });

  const monitors = monitorsData?.monitors || [];

  const [isConnecting, setIsConnecting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [directModeAvailable, setDirectModeAvailable] = useState<boolean | null>(null);

  // Feature detection: check if ZM server supports Notifications API
  useEffect(() => {
    if (!currentProfile || !isAuthenticated) return;

    checkNotificationsApiSupport()
      .then((supported) => {
        setDirectModeAvailable(supported);
        log.notificationSettings('ZM Notifications API support check', LogLevel.INFO, { supported });
      })
      .catch(() => {
        setDirectModeAvailable(false);
      });
  }, [currentProfile?.id, isAuthenticated]);

  const handleEnableToggle = async (enabled: boolean) => {
    if (!currentProfile) {
      toast.error(t('notification_settings.no_profile'));
      return;
    }

    updateProfileSettings(currentProfile.id, { enabled });

    if (enabled) {
      // Auto-detect host from current profile if not set
      if (!settings?.host && currentProfile) {
        try {
          const url = new URL(currentProfile.portalUrl);
          // Use wss:// scheme for the notification server
          const wsHost = url.hostname;
          updateProfileSettings(currentProfile.id, { host: wsHost });
          log.notificationSettings('Auto-populated notification host from profile', LogLevel.INFO, { host: wsHost, });
        } catch (error) {
          log.notificationSettings('Failed to parse portal URL', LogLevel.ERROR, error);
        }
      }

      toast.info(t('notification_settings.notifications_enabled'));
    } else {
      // Deregister push notifications on mobile platforms
      if (Capacitor.isNativePlatform()) {
        try {
          const { getPushService } = await import('../services/pushNotifications');
          const pushService = getPushService();
          await pushService.deregister();
          log.notificationSettings('Deregistered from push notifications', LogLevel.INFO);
        } catch (error) {
          log.notificationSettings('Failed to deregister from push notifications', LogLevel.ERROR, error);
        }
      }

      disconnect();
      toast.info(t('notification_settings.notifications_disabled'));
    }
  };

  const handleConnect = async () => {
    if (!currentProfile) {
      toast.error(t('notification_settings.no_profile'));
      return;
    }

    if (!settings?.host) {
      toast.error(t('notification_settings.enter_host'));
      return;
    }

    if (!currentProfile.username || !currentProfile.password) {
      toast.error(t('notification_settings.profile_credentials_required'));
      return;
    }

    setIsConnecting(true);

    try {
      // Get decrypted password
      const password = await getDecryptedPassword(currentProfile.id);
      if (!password) {
        throw new Error('Failed to get password');
      }

      await connect(currentProfile.id, currentProfile.username, password, currentProfile.portalUrl);
      toast.success(t('notification_settings.connected_success'));

      // Push token will be registered automatically by the connect method
    } catch (error) {
      log.notificationSettings('Connection failed', LogLevel.ERROR, error);
      toast.error(t('notification_settings.connect_failed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast.info(t('notification_settings.disconnected'));
  };

  const handleModeChange = async (mode: NotificationMode) => {
    if (!currentProfile) return;

    const currentMode = settings?.notificationMode || 'es';
    if (mode === currentMode) return;

    log.notificationSettings('Switching notification mode', LogLevel.INFO, { from: currentMode, to: mode });

    if (currentMode === 'es' && mode === 'direct') {
      // Switching from ES to Direct: disconnect websocket, start poller on desktop
      disconnect();
      updateProfileSettings(currentProfile.id, { notificationMode: 'direct' });

      if (Platform.isDesktopOrWeb) {
        // Desktop (Tauri) or web browser: start event poller
        log.notificationSettings('Starting event poller from mode switch', LogLevel.INFO);
        const poller = getEventPoller();
        poller.start(currentProfile.id);
      }

      toast.info(t('notification_settings.mode_switched_direct'));
    } else if (currentMode === 'direct' && mode === 'es') {
      // Switching from Direct to ES: stop poller, connect websocket
      const poller = getEventPoller();
      if (poller.isRunning()) {
        poller.stop();
      }

      updateProfileSettings(currentProfile.id, { notificationMode: 'es' });

      // Auto-connect websocket if host is configured
      if (settings?.host && currentProfile.username && currentProfile.password) {
        try {
          const password = await getDecryptedPassword(currentProfile.id);
          if (password) {
            await connect(currentProfile.id, currentProfile.username, password, currentProfile.portalUrl);
          }
        } catch (error) {
          log.notificationSettings('Failed to connect after switching to ES mode', LogLevel.ERROR, error);
        }
      }

      toast.info(t('notification_settings.mode_switched_es'));
    }
  };

  const handleAllMonitorsToggle = (allMonitors: boolean) => {
    if (!currentProfile) return;
    updateProfileSettings(currentProfile.id, { allMonitors });
  };

  const handleMonitorToggle = (monitorId: number, enabled: boolean) => {
    if (!currentProfile) return;

    if (enabled) {
      setMonitorFilter(currentProfile.id, monitorId, true, 60); // Default 60 second interval
    } else {
      setMonitorFilter(currentProfile.id, monitorId, false);
    }
  };

  const handleIntervalChange = (monitorId: number, interval: number) => {
    if (!currentProfile || !settings) return;

    const filter = settings.monitorFilters.find((f) => f.monitorId === monitorId);
    if (filter) {
      setMonitorFilter(currentProfile.id, monitorId, filter.enabled, interval);
    }
  };

  const getConnectionBadge = () => {
    const mode = settings?.notificationMode || 'es';

    // Direct mode doesn't use a WebSocket — show mode-specific status
    if (mode === 'direct' && settings?.enabled) {
      return (
        <Badge variant="default" className="gap-1.5 bg-blue-500">
          <CheckCircle className="h-3 w-3" />
          {t('notifications.status.direct_active')}
        </Badge>
      );
    }

    switch (connectionState) {
      case 'connected':
        return (
          <Badge variant="default" className="gap-1.5">
            <CheckCircle className="h-3 w-3" />
            {t('notification_settings.status_connected')}
          </Badge>
        );
      case 'connecting':
      case 'authenticating':
        return (
          <Badge variant="secondary" className="gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('notification_settings.status_connecting')}
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1.5">
            <XCircle className="h-3 w-3" />
            {t('notification_settings.status_error')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1.5">
            <WifiOff className="h-3 w-3" />
            {t('notification_settings.status_disconnected')}
          </Badge>
        );
    }
  };

  // Early return if no profile
  if (!currentProfile || !settings) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto" data-testid="notification-settings-empty">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">{t('notification_settings.no_profile')}</h2>
            <p className="text-muted-foreground">{t('notification_settings.select_profile_first')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8" data-testid="notification-settings">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('notification_settings.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('notification_settings.subtitle')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/notifications/history')}
          className="relative"
          data-testid="notification-history-button"
        >
          <History className="h-4 w-4 mr-2" />
          {t('notification_settings.view_history')}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 min-w-5 px-1 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Enable/Disable */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {settings.enabled ? (
                  <Bell className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <CardTitle className="text-lg sm:text-xl">{t('notification_settings.status_title')}</CardTitle>
              </div>
              <div className="self-start sm:self-auto">
                {getConnectionBadge()}
              </div>
            </div>
            <CardDescription className="mt-1.5">
              {t('notification_settings.status_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex-1 space-y-1">
                <Label htmlFor="enable-notifications" className="text-base font-semibold">
                  {t('notification_settings.enable_notifications')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('notification_settings.enable_notifications_desc')}
                </p>
              </div>
              <Switch
                id="enable-notifications"
                checked={settings.enabled}
                onCheckedChange={handleEnableToggle}
                data-testid="notification-enable-toggle"
              />
            </div>

            {unreadCount > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <AlertCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {t('notification_settings.unread_count', { count: unreadCount })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification Mode Selector */}
        {settings.enabled && (
          <Card>
            <CardHeader>
              <CardTitle>{t('notification_settings.mode_title')}</CardTitle>
              <CardDescription>
                {t('notification_settings.mode_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* ES Mode */}
                <button
                  type="button"
                  onClick={() => handleModeChange('es')}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    (settings.notificationMode || 'es') === 'es'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                  data-testid="notification-mode-es"
                >
                  <div className="font-semibold text-sm">{t('notification_settings.mode_es')}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('notification_settings.mode_es_desc')}
                  </p>
                </button>

                {/* Direct Mode */}
                <button
                  type="button"
                  onClick={() => handleModeChange('direct')}
                  disabled={directModeAvailable !== true}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    settings.notificationMode === 'direct'
                      ? 'border-primary bg-primary/5'
                      : directModeAvailable
                        ? 'border-border hover:border-muted-foreground/50'
                        : 'border-border opacity-50 cursor-not-allowed'
                  }`}
                  title={directModeAvailable === false ? t('notification_settings.mode_direct_unavailable') : undefined}
                  data-testid="notification-mode-direct"
                >
                  <div className="font-semibold text-sm">{t('notification_settings.mode_direct')}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('notification_settings.mode_direct_desc')}
                  </p>
                  {directModeAvailable === false && (
                    <p className="text-xs text-destructive mt-1">
                      {t('notification_settings.mode_direct_unavailable')}
                    </p>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Direct Mode Options */}
        {settings.enabled && settings.notificationMode === 'direct' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('notification_settings.direct_options_title')}</CardTitle>
              <CardDescription>
                {t('notification_settings.direct_options_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('notification_settings.polling_interval')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('notification_settings.polling_interval_desc')}
                  </p>
                </div>
                <Select
                  value={String(settings.pollingInterval || 30)}
                  onValueChange={(value) => {
                    updateProfileSettings(currentProfile.id, { pollingInterval: parseInt(value, 10) });
                    // Restart poller with new interval
                    const poller = getEventPoller();
                    if (poller.isRunning()) {
                      poller.start(currentProfile.id);
                    }
                  }}
                >
                  <SelectTrigger className="w-28" data-testid="polling-interval-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10s</SelectItem>
                    <SelectItem value="15">15s</SelectItem>
                    <SelectItem value="30">30s</SelectItem>
                    <SelectItem value="60">60s</SelectItem>
                    <SelectItem value="120">120s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="only-detected">{t('notification_settings.only_detected')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('notification_settings.only_detected_desc')}
                  </p>
                </div>
                <Switch
                  id="only-detected"
                  checked={settings.onlyDetectedEvents || false}
                  onCheckedChange={(checked) =>
                    updateProfileSettings(currentProfile.id, { onlyDetectedEvents: checked })
                  }
                  data-testid="only-detected-toggle"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Server Configuration (ES mode only) */}
        {settings.enabled && (settings.notificationMode || 'es') === 'es' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                <CardTitle>{t('notification_settings.server_config_title')}</CardTitle>
              </div>
              <CardDescription>
                {t('notification_settings.server_config_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Host */}
              <div className="space-y-2">
                <Label htmlFor="host" className="text-base font-semibold">
                  {t('notification_settings.server_host')}
                </Label>
                <Input
                  id="host"
                  type="text"
                  placeholder={t('notification_settings.host_placeholder')}
                  value={settings.host}
                  onChange={(e) => updateProfileSettings(currentProfile.id, { host: e.target.value })}
                  disabled={isConnected}
                  autoCapitalize="none"
                  autoCorrect="off"
                  data-testid="notification-host-input"
                />
                <p className="text-xs text-muted-foreground">
                  {t('notification_settings.server_host_desc')}
                </p>
              </div>

              {/* Advanced Settings */}
              <div className="space-y-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  data-testid="notification-advanced-toggle"
                >
                  {showAdvanced ? t('notification_settings.hide_advanced') : t('notification_settings.show_advanced')}
                </Button>

                {showAdvanced && (
                  <div className="space-y-4 p-4 rounded-lg border bg-muted/50">
                    {/* Port */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="port">{t('notification_settings.port')}</Label>
                        <Input
                          id="port"
                          type="number"
                          value={settings.port}
                          onChange={(e) => updateProfileSettings(currentProfile.id, { port: Number(e.target.value) })}
                          disabled={isConnected}
                          data-testid="notification-port-input"
                        />
                        <p className="text-xs text-muted-foreground">{t('notification_settings.default_port')}</p>
                      </div>

                      {/* SSL */}
                      <div className="space-y-2">
                        <Label htmlFor="ssl" className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          {t('notification_settings.use_ssl')}
                        </Label>
                        <div className="flex items-center h-10">
                          <Switch
                            id="ssl"
                            checked={settings.ssl}
                            onCheckedChange={(checked) => updateProfileSettings(currentProfile.id, { ssl: checked })}
                            disabled={isConnected}
                            data-testid="notification-ssl-toggle"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('notification_settings.ssl_desc')}
                        </p>
                      </div>
                    </div>

                    {/* Toast and Sound Settings */}
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="show-toasts" className="text-sm">
                            {t('notification_settings.show_toasts')}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t('notification_settings.show_toasts_desc')}
                          </p>
                        </div>
                        <Switch
                          id="show-toasts"
                          checked={settings.showToasts}
                          onCheckedChange={(checked) => updateProfileSettings(currentProfile.id, { showToasts: checked })}
                          data-testid="notification-show-toasts-toggle"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="play-sound" className="text-sm">
                            {t('notification_settings.play_sound')}
                          </Label>
                          <p className="text-xs text-muted-foreground">{t('notification_settings.play_sound_desc')}</p>
                        </div>
                        <Switch
                          id="play-sound"
                          checked={settings.playSound}
                          onCheckedChange={(checked) => updateProfileSettings(currentProfile.id, { playSound: checked })}
                          data-testid="notification-play-sound-toggle"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Connection Button */}
              <div className="flex gap-2">
                {isConnected ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleDisconnect}
                      className="flex-1"
                      data-testid="notification-disconnect-button"
                    >
                      <WifiOff className="h-4 w-4 mr-2" />
                      {t('notification_settings.disconnect')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="flex-1"
                      data-testid="notification-reconnect-button"
                    >
                      {isConnecting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wifi className="h-4 w-4 mr-2" />
                      )}
                      {t('notification_settings.reconnect')}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleConnect}
                    disabled={isConnecting || !settings.host}
                    className="flex-1"
                    data-testid="notification-connect-button"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wifi className="h-4 w-4 mr-2" />
                    )}
                    {t('notification_settings.connect')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monitor Filters */}
        {settings.enabled && monitors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('notification_settings.monitor_filters_title')}</CardTitle>
              <CardDescription>
                {t('notification_settings.monitor_filters_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* All Monitors toggle */}
              <div
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
                data-testid="notification-all-monitors-card"
              >
                <div className="flex-1 space-y-1">
                  <Label htmlFor="all-monitors" className="text-base font-semibold">
                    {t('notification_settings.all_monitors')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('notification_settings.all_monitors_desc')}
                  </p>
                </div>
                <Switch
                  id="all-monitors"
                  checked={settings.allMonitors}
                  onCheckedChange={handleAllMonitorsToggle}
                  data-testid="notification-all-monitors-toggle"
                />
              </div>

              {/* Individual monitor filters — only shown when allMonitors is off */}
              {!settings.allMonitors && monitors.map((monitor) => {
                const monitorData = monitor.Monitor;
                const filter = settings.monitorFilters.find(
                  (f) => f.monitorId === parseInt(monitorData.Id, 10)
                );
                const isEnabled = filter?.enabled || false;
                const interval = filter?.checkInterval || 60;

                return (
                  <div
                    key={monitorData.Id}
                    className="flex flex-col gap-3 p-4 rounded-lg border bg-card"
                    data-testid={`notification-monitor-card-${monitorData.Id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label
                          htmlFor={`monitor-${monitorData.Id}`}
                          className="text-base font-semibold"
                        >
                          {monitorData.Name}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {t('notification_settings.monitor_id', { id: monitorData.Id })} • {t('notification_settings.function')}: {monitorData.Function}
                        </p>
                      </div>
                      <Switch
                        id={`monitor-${monitorData.Id}`}
                        checked={isEnabled}
                        onCheckedChange={(checked) =>
                          handleMonitorToggle(parseInt(monitorData.Id, 10), checked)
                        }
                        data-testid={`notification-monitor-toggle-${monitorData.Id}`}
                      />
                    </div>

                    {isEnabled && (
                      <div className="flex flex-col gap-2 ml-6 pt-2 border-t">
                        <Label htmlFor={`interval-${monitorData.Id}`} className="text-sm">
                          {t('notification_settings.check_interval')}:
                        </Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            id={`interval-${monitorData.Id}`}
                            type="number"
                            min="30"
                            max="3600"
                            step="30"
                            value={interval}
                            onChange={(e) =>
                              handleIntervalChange(
                                parseInt(monitorData.Id, 10),
                                Number(e.target.value)
                              )
                            }
                            className="w-24"
                            data-testid={`notification-monitor-interval-${monitorData.Id}`}
                          />
                          <span className="text-sm text-muted-foreground">{t('notification_settings.seconds')}</span>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleIntervalChange(parseInt(monitorData.Id, 10), 30)
                              }
                              data-testid={`notification-monitor-interval-30-${monitorData.Id}`}
                            >
                              {t('notification_settings.quick_interval_seconds', { value: 30 })}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleIntervalChange(parseInt(monitorData.Id, 10), 60)
                              }
                              data-testid={`notification-monitor-interval-60-${monitorData.Id}`}
                            >
                              {t('notification_settings.quick_interval_seconds', { value: 60 })}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleIntervalChange(parseInt(monitorData.Id, 10), 120)
                              }
                              data-testid={`notification-monitor-interval-120-${monitorData.Id}`}
                            >
                              {t('notification_settings.quick_interval_minutes', { value: 2 })}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {monitors.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('notification_settings.no_monitors')}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Platform Info */}
        {Capacitor.isNativePlatform() && settings.enabled && (
          <Card>
            <CardHeader>
              <CardTitle>{t('notification_settings.mobile_platform')}</CardTitle>
              <CardDescription>
                {t('notification_settings.push_enabled')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  {t('notification_settings.running_on', { platform: Capacitor.getPlatform() })}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
