import { Image, Settings as SettingsIcon, Video as VideoIcon, Zap, Gauge, Leaf } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { useSettingsStore, type WebRTCProtocol } from '../../stores/settings';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';
import { getBandwidthSettings, type BandwidthMode } from '../../lib/zmninja-ng-constants';

// Protocol checkbox configuration
const PROTOCOLS: { id: WebRTCProtocol; label: string; descKey: string }[] = [
    { id: 'webrtc', label: 'WebRTC', descKey: 'settings.protocol_webrtc_desc' },
    { id: 'mse', label: 'MSE', descKey: 'settings.protocol_mse_desc' },
    { id: 'hls', label: 'HLS', descKey: 'settings.protocol_hls_desc' },
];

export function VideoSettings() {
    const { t } = useTranslation();
    const { currentProfile, settings } = useCurrentProfile();
    const updateSettings = useSettingsStore((state) => state.updateProfileSettings);

    // Generic setting update helper
    const update = <K extends keyof Parameters<typeof updateSettings>[1]>(
        key: K,
        value: Parameters<typeof updateSettings>[1][K]
    ) => {
        if (!currentProfile) return;
        updateSettings(currentProfile.id, { [key]: value });
    };

    const handleProtocolChange = (protocol: WebRTCProtocol, enabled: boolean) => {
        if (!currentProfile) return;
        const current = settings.webrtcProtocols || ['webrtc', 'mse', 'hls'];
        const updated = enabled
            ? current.includes(protocol) ? current : [...current, protocol]
            : current.filter(p => p !== protocol);

        // Ensure at least one protocol remains
        if (updated.length > 0) {
            updateSettings(currentProfile.id, { webrtcProtocols: updated });
        }
    };

    const handleBandwidthModeChange = (isLow: boolean) => {
        if (!currentProfile) return;
        const mode: BandwidthMode = isLow ? 'low' : 'normal';
        const bandwidthDefaults = getBandwidthSettings(mode);

        // Update bandwidth mode and all related settings to the new defaults
        updateSettings(currentProfile.id, {
            bandwidthMode: mode,
            streamScale: bandwidthDefaults.imageScale,
            streamMaxFps: bandwidthDefaults.streamMaxFps,
            snapshotRefreshInterval: bandwidthDefaults.snapshotRefreshInterval,
        });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5 text-primary" />
                    <CardTitle>{t('settings.video_display_settings')}</CardTitle>
                </div>
                <CardDescription>
                    {t('settings.video_display_desc')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Bandwidth Mode Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border bg-card">
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="bandwidth-mode" className="text-base font-semibold">
                                {t('settings.bandwidth_mode')}
                            </Label>
                            {settings.bandwidthMode === 'low' && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                    {t('settings.bandwidth_saving')}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {settings.bandwidthMode === 'low'
                                ? t('settings.bandwidth_low_desc')
                                : t('settings.bandwidth_normal_desc')}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                            <Gauge className="h-4 w-4" />
                            <span className="font-medium">{t('settings.bandwidth_normal')}</span>
                        </div>
                        <Switch
                            id="bandwidth-mode"
                            checked={settings.bandwidthMode === 'low'}
                            onCheckedChange={handleBandwidthModeChange}
                            data-testid="settings-bandwidth-mode-switch"
                        />
                        <div className="flex items-center gap-2 text-sm">
                            <Leaf className="h-4 w-4 text-green-600" />
                            <span className="font-medium">{t('settings.bandwidth_low')}</span>
                        </div>
                    </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border bg-card">
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="view-mode" className="text-base font-semibold">
                                {t('settings.streaming_mode')}
                            </Label>
                            {settings.viewMode === 'snapshot' && (
                                <Badge variant="secondary" className="text-xs">
                                    {t('settings.recommended')}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {settings.viewMode === 'streaming'
                                ? t('settings.streaming_mode_desc')
                                : t('settings.snapshot_mode_desc')}
                        </p>
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                            {t('settings.snapshot_warning')}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                            <Image className="h-4 w-4" />
                            <span className="font-medium">{t('settings.snapshot')}</span>
                        </div>
                        <Switch
                            id="view-mode"
                            checked={settings.viewMode === 'streaming'}
                            onCheckedChange={(checked) => update('viewMode', checked ? 'streaming' : 'snapshot')}
                            data-testid="settings-view-mode-switch"
                        />
                        <div className="flex items-center gap-2 text-sm">
                            <VideoIcon className="h-4 w-4" />
                            <span className="font-medium">{t('settings.streaming')}</span>
                        </div>
                    </div>
                </div>

                {/* WebRTC/HLS/MSE Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border bg-card">
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="go2rtc-mode" className="text-base font-semibold">
                                {t('settings.enable_go2rtc')}
                            </Label>
                            <Zap className="h-4 w-4 text-yellow-500" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.enable_go2rtc_desc')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {settings.streamingMethod === 'auto'
                                ? t('settings.go2rtc_enabled_note')
                                : t('settings.go2rtc_disabled_note')}
                        </p>
                    </div>
                    <Switch
                        id="go2rtc-mode"
                        checked={settings.streamingMethod === 'auto'}
                        onCheckedChange={(enabled) => update('streamingMethod', enabled ? 'auto' : 'mjpeg')}
                        data-testid="settings-go2rtc-switch"
                    />
                </div>

                {settings.streamingMethod === 'auto' && (
                    <div className="space-y-3 p-4 rounded-lg border bg-muted/50 ml-4">
                        <div>
                            <Label className="text-base font-semibold">
                                {t('settings.webrtc_protocols')}
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t('settings.webrtc_protocols_desc')}
                            </p>
                        </div>
                        <div className="space-y-3">
                            {PROTOCOLS.map(({ id, label, descKey }) => (
                                <div key={id} className="flex items-start space-x-3">
                                    <Checkbox
                                        id={`protocol-${id}`}
                                        checked={settings.webrtcProtocols?.includes(id) ?? true}
                                        onCheckedChange={(checked) => handleProtocolChange(id, checked === true)}
                                        data-testid={`protocol-${id}-checkbox`}
                                    />
                                    <div className="grid gap-0.5 leading-none">
                                        <Label htmlFor={`protocol-${id}`} className="font-medium cursor-pointer">
                                            {label}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            {t(descKey)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {settings.viewMode === 'snapshot' && (
                    <div className="space-y-3 p-4 rounded-lg border bg-muted/50">
                        <div>
                            <Label htmlFor="refresh-interval" className="text-base font-semibold">
                                {t('settings.refresh_interval')}
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t('settings.refresh_interval_desc')}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <Input
                                id="refresh-interval"
                                type="number"
                                min="1"
                                max="30"
                                value={settings.snapshotRefreshInterval}
                                onChange={(e) => update('snapshotRefreshInterval', Number(e.target.value))}
                                className="w-24"
                                data-testid="settings-refresh-interval"
                            />
                            <span className="text-sm text-muted-foreground">{t('settings.seconds')}</span>
                            <div className="flex flex-wrap gap-2 sm:ml-auto">
                                {[1, 3, 5].map((val) => (
                                    <Button
                                        key={val}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => update('snapshotRefreshInterval', val)}
                                    >
                                        {val}s{val === 3 ? ` (${t('settings.default')})` : ''}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-3 p-4 rounded-lg border bg-muted/50">
                    <div>
                        <Label htmlFor="stream-fps" className="text-base font-semibold">
                            {t('settings.stream_fps')}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('settings.stream_fps_desc')}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <Input
                            id="stream-fps"
                            type="number"
                            min="1"
                            max="30"
                            value={settings.streamMaxFps}
                            onChange={(e) => update('streamMaxFps', Number(e.target.value))}
                            className="w-24"
                            data-testid="stream-fps-input"
                        />
                        <span className="text-sm text-muted-foreground">{t('settings.fps_label')}</span>
                        <div className="flex flex-wrap gap-2 sm:ml-auto">
                            {[5, 10, 15, 30].map((val) => (
                                <Button
                                    key={val}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => update('streamMaxFps', val)}
                                    data-testid={`stream-fps-${val}`}
                                >
                                    {val === 10
                                        ? t('settings.fps_option_default', { value: val })
                                        : t('settings.fps_option', { value: val })}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-3 p-4 rounded-lg border bg-muted/50">
                    <div>
                        <Label htmlFor="stream-scale" className="text-base font-semibold">
                            {t('settings.stream_scale')}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('settings.stream_scale_desc')}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <Input
                            id="stream-scale"
                            type="number"
                            min="10"
                            max="100"
                            step="10"
                            value={settings.streamScale}
                            onChange={(e) => update('streamScale', Number(e.target.value))}
                            className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                        <div className="flex flex-wrap gap-2 sm:ml-auto">
                            {[25, 50, 75, 100].map((val) => (
                                <Button
                                    key={val}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => update('streamScale', val)}
                                >
                                    {val}%{val === 50 ? ` (${t('settings.default')})` : ''}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
