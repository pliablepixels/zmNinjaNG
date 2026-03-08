import { useLogStore } from '../stores/logs';
import { logger, log, LogLevel } from '../lib/logger';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useSettingsStore } from '../stores/settings';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollText, Trash2, Download, Share2, ChevronDown, ChevronUp, Server, Smartphone } from 'lucide-react';
import { cn } from '../lib/utils';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { useToast } from '../hooks/use-toast';
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAppVersion } from '../lib/version';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import type { LogEntry } from '../stores/logs';
import { getZMLogs, getZMLogLevel, getUniqueZMComponents } from '../api/logs';
import type { ZMLog } from '../api/types';

function LogCodeBlock({ content }: { content: string }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { t } = useTranslation();
    const lines = content.split('\n');
    const shouldTruncate = lines.length > 30;
    const displayContent = shouldTruncate && !isExpanded
        ? lines.slice(0, 30).join('\n')
        : content;

    return (
        <div className="mt-1">
            <pre className="p-2 bg-muted rounded text-[10px] overflow-x-auto">
                {displayContent}
            </pre>
            {shouldTruncate && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="mt-1 text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="h-3 w-3" />
                            {t('logs.show_less')}
                        </>
                    ) : (
                        <>
                            <ChevronDown className="h-3 w-3" />
                            {t('logs.show_more', { count: lines.length - 30 })}
                        </>
                    )}
                </button>
            )}
        </div>
    );
}

type LogSource = 'zmng' | 'server';

export default function Logs() {
    const logs = useLogStore((state) => state.logs);
    const clearLogs = useLogStore((state) => state.clearLogs);
    const { toast } = useToast();
    const { t } = useTranslation();
    const isNative = Capacitor.isNativePlatform();
    const { currentProfile, settings } = useCurrentProfile();
    const { logLevel } = settings;
    const updateProfileSettings = useSettingsStore((state) => state.updateProfileSettings);
    const [selectedComponentsZmng, setSelectedComponentsZmng] = useState<string[]>([]);
    const [selectedComponentsServer, setSelectedComponentsServer] = useState<string[]>([]);
    const [logSource, setLogSource] = useState<LogSource>('zmng');
    const [zmLogs, setZmLogs] = useState<ZMLog[]>([]);
    const [isLoadingZmLogs, setIsLoadingZmLogs] = useState(false);
    const unassignedComponentValue = 'unassigned';

    // Use the appropriate component filter based on log source
    const selectedComponents = logSource === 'zmng' ? selectedComponentsZmng : selectedComponentsServer;
    const setSelectedComponents = logSource === 'zmng' ? setSelectedComponentsZmng : setSelectedComponentsServer;

    // Fetch ZM logs when switching to server view
    useEffect(() => {
        if (logSource === 'server') {
            setIsLoadingZmLogs(true);
            getZMLogs({ limit: 100 })
                .then((response) => {
                    const logs = response.logs.map((logData) => logData.Log);
                    setZmLogs(logs);
                })
                .catch((error) => {
                    toast({
                        title: t('common.error'),
                        description: t('logs.zm_fetch_failed'),
                        variant: 'destructive',
                    });
                    log.server('Failed to fetch ZM logs', LogLevel.ERROR, { error });
                })
                .finally(() => {
                    setIsLoadingZmLogs(false);
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logSource]);

    const handleLevelChange = (value: string) => {
        const level = parseInt(value, 10) as LogLevel;
        logger.setLevel(level);
        if (currentProfile?.id) {
            updateProfileSettings(currentProfile.id, { logLevel: level });
        }
        toast({
            title: t('common.success'),
            description: t('logs.level_updated'),
        });
    };

    // Map log level strings to numeric values for filtering
    const logLevelValue = (level: string): number => {
        switch (level) {
            case 'DEBUG': return LogLevel.DEBUG;
            case 'INFO': return LogLevel.INFO;
            case 'WARN': return LogLevel.WARN;
            case 'ERROR': return LogLevel.ERROR;
            default: return LogLevel.DEBUG;
        }
    };

    const getLogComponentValue = (log: LogEntry) => {
        const component = log.context?.component;
        if (typeof component === 'string' && component.trim().length > 0) {
            return component;
        }
        return unassignedComponentValue;
    };

    const componentOptions = useMemo(() => {
        const components = new Set<string>();
        let hasUnassigned = false;

        if (logSource === 'zmng') {
            logs.forEach((log) => {
                const component = log.context?.component;
                if (typeof component === 'string' && component.trim().length > 0) {
                    components.add(component);
                } else {
                    hasUnassigned = true;
                }
            });
        } else {
            // ZM server logs
            const zmComponents = getUniqueZMComponents(zmLogs);
            zmComponents.forEach((component) => components.add(component));
        }

        const sortedComponents = Array.from(components).sort((a, b) => a.localeCompare(b));
        const options = sortedComponents.map((component) => ({
            value: component,
            label: component,
        }));

        if (hasUnassigned && logSource === 'zmng') {
            options.push({
                value: unassignedComponentValue,
                label: t('logs.component_unassigned'),
            });
        }

        return options;
    }, [logs, zmLogs, logSource, t]);

    const toggleComponent = (value: string) => {
        setSelectedComponents((prev) => (
            prev.includes(value)
                ? prev.filter((item) => item !== value)
                : [...prev, value]
        ));
    };

    const selectedLabel = (() => {
        if (selectedComponents.length === 0) {
            return t('logs.component_filter_all');
        }
        if (selectedComponents.length === 1) {
            const selected = selectedComponents[0];
            const option = componentOptions.find((item) => item.value === selected);
            return option?.label ?? selected;
        }
        return t('logs.component_filter_selected', { count: selectedComponents.length });
    })();

    const toTestId = (value: string) =>
        value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Convert ZM logs to unified display format
    const zmLogsAsDisplay = useMemo(() => {
        return zmLogs.map((zmLog) => ({
            id: zmLog.Id.toString(),
            timestamp: new Date(parseFloat(zmLog.TimeKey) * 1000).toLocaleString(),
            level: getZMLogLevel(zmLog.Level),
            message: zmLog.Message,
            context: {
                component: zmLog.Component,
                file: zmLog.File,
                line: zmLog.Line,
                pid: zmLog.Pid,
            },
            args: [],
        }));
    }, [zmLogs]);

    // Filter logs based on selected level and components
    const currentLevel = logLevel;
    const filteredLogs = (logSource === 'zmng' ? logs : zmLogsAsDisplay).filter((log) => {
        const passesLevel = logLevelValue(log.level) >= currentLevel;
        if (!passesLevel) return false;
        if (selectedComponents.length === 0) return true;
        const componentValue = logSource === 'zmng'
            ? getLogComponentValue(log as LogEntry)
            : (log.context?.component as string || '');
        return selectedComponents.includes(componentValue);
    });

    const exportLogsAsText = (entries: LogEntry[]) => {
        const logText = entries.map(log => {
            let text = `[${log.timestamp}] [${log.level}]`;
            if (log.context?.component) {
                text += ` [${log.context.component}]`;
            }
            text += ` ${log.message}`;

            if (log.args && log.args.length > 0) {
                text += '\n  Args: ' + log.args.map(arg =>
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(', ');
            }

            if (log.context && Object.keys(log.context).length > 0) {
                const contextEntries = Object.entries(log.context)
                    .filter(([key]) => key !== 'component')
                    .map(([key, value]) => `${key}: ${String(value)}`);
                if (contextEntries.length > 0) {
                    text += '\n  Context: ' + contextEntries.join(', ');
                }
            }

            return text;
        }).join('\n\n');

        return logText || t('logs.no_logs_available');
    };

    const handleSaveLogs = () => {
        const logText = exportLogsAsText(filteredLogs);
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = logSource === 'zmng'
            ? `zmng-logs-${dateStr}.txt`
            : `zm-server-logs-${dateStr}.txt`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
            title: t('common.success'),
            description: t('logs.logs_saved'),
        });
    };

    const handleShareLogs = async () => {
        const logText = exportLogsAsText(filteredLogs);

        try {
            await Share.share({
                title: t('logs.share_title'),
                text: logText,
                dialogTitle: t('logs.share_dialog_title'),
            });
        } catch (error) {
            toast({
                title: t('common.error'),
                description: t('logs.share_failed'),
                variant: 'destructive',
            });
        }
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'ERROR': return 'bg-destructive text-destructive-foreground hover:bg-destructive/80';
            case 'WARN': return 'bg-orange-500 text-white hover:bg-orange-600';
            case 'INFO': return 'bg-blue-500 text-white hover:bg-blue-600';
            case 'DEBUG': return 'bg-gray-500 text-white hover:bg-gray-600';
            default: return 'bg-secondary text-secondary-foreground';
        }
    };

    const appVersion = getAppVersion();

    return (
        <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 h-[calc(100vh-4rem)] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">{t('logs.title')}</h1>
                        <Badge variant="outline" className="text-xs">v{appVersion}</Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        {logSource === 'zmng' ? t('logs.subtitle') : 'ZoneMinder Server Logs'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex h-8 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground" data-testid="log-source-tabs">
                        <Button
                            variant={logSource === 'zmng' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-6 px-3 text-xs"
                            onClick={() => setLogSource('zmng')}
                            data-testid="log-source-zmng"
                        >
                            <Smartphone className="h-3 w-3 mr-1.5" />
                            zmNinjaNG
                        </Button>
                        <Button
                            variant={logSource === 'server' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-6 px-3 text-xs"
                            onClick={() => setLogSource('server')}
                            data-testid="log-source-server"
                        >
                            <Server className="h-3 w-3 mr-1.5" />
                            Server
                        </Button>
                    </div>
                    <Select value={logLevel.toString()} onValueChange={handleLevelChange}>
                        <SelectTrigger className="w-[100px] h-8" data-testid="log-level-select">
                            <SelectValue placeholder={t('logs.level_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={LogLevel.DEBUG.toString()} data-testid="log-level-option-DEBUG">{t('logs.level_debug')}</SelectItem>
                            <SelectItem value={LogLevel.INFO.toString()} data-testid="log-level-option-INFO">{t('logs.level_info')}</SelectItem>
                            <SelectItem value={LogLevel.WARN.toString()} data-testid="log-level-option-WARN">{t('logs.level_warn')}</SelectItem>
                            <SelectItem value={LogLevel.ERROR.toString()} data-testid="log-level-option-ERROR">{t('logs.level_error')}</SelectItem>
                        </SelectContent>
                    </Select>
                    <div data-testid="log-component-filter">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1"
                                    data-testid="log-component-filter-trigger"
                                >
                                    <span className="text-xs text-muted-foreground">{t('logs.component_filter_label')}</span>
                                    <span className="text-xs font-medium">{selectedLabel}</span>
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2" align="end" data-testid="log-component-filter-options">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2" data-testid="log-component-filter-option-all">
                                        <Checkbox
                                            id="log-component-filter-all"
                                            checked={selectedComponents.length === 0}
                                            onCheckedChange={() => setSelectedComponents([])}
                                            data-testid="log-component-filter-checkbox-all"
                                        />
                                        <Label htmlFor="log-component-filter-all" className="text-xs">
                                            {t('logs.component_filter_all')}
                                        </Label>
                                    </div>
                                    {componentOptions.length === 0 ? (
                                        <div className="text-xs text-muted-foreground">
                                            {t('logs.no_logs_available')}
                                        </div>
                                    ) : (
                                        componentOptions.map((option) => {
                                            const optionTestId = option.value === unassignedComponentValue
                                                ? 'unassigned'
                                                : toTestId(option.value) || 'unknown';
                                            const optionId = `log-component-filter-${optionTestId}`;
                                            return (
                                                <div
                                                    key={option.value}
                                                    className="flex items-center gap-2"
                                                    data-testid={`log-component-filter-option-${optionTestId}`}
                                                >
                                                    <Checkbox
                                                        id={optionId}
                                                        checked={selectedComponents.includes(option.value)}
                                                        onCheckedChange={() => toggleComponent(option.value)}
                                                        data-testid={`log-component-filter-checkbox-${optionTestId}`}
                                                    />
                                                    <Label htmlFor={optionId} className="text-xs">
                                                        {option.label}
                                                    </Label>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    {isNative ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleShareLogs}
                            disabled={filteredLogs.length === 0}
                            data-testid="logs-share-button"
                        >
                            <Share2 className="h-4 w-4 mr-2" />
                            {t('logs.share')}
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSaveLogs}
                            disabled={filteredLogs.length === 0}
                            data-testid="logs-save-button"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            {t('logs.save')}
                        </Button>
                    )}
                    {logSource === 'zmng' && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={clearLogs}
                            disabled={logs.length === 0}
                            data-testid="logs-clear-button"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('logs.clear_logs')}
                        </Button>
                    )}
                </div>
            </div>

            <Card className="flex-1 overflow-hidden flex flex-col">
                <CardHeader className="py-3 px-4 border-b shrink-0">
                    <div className="flex items-center gap-2">
                        <ScrollText className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{t('logs.log_entries', { count: filteredLogs.length })}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-y-auto font-mono text-xs sm:text-sm">
                    {isLoadingZmLogs ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                            <ScrollText className="h-12 w-12 mb-4 opacity-20 animate-pulse" />
                            <p>{t('logs.loading_server_logs')}</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8" data-testid="logs-empty-state">
                            <ScrollText className="h-12 w-12 mb-4 opacity-20" />
                            <p>{logSource === 'zmng' ? t('logs.no_logs_available') : t('logs.no_server_logs')}</p>
                        </div>
                    ) : (
                        <div className="divide-y" data-testid="log-entries">
                            {filteredLogs.map((log) => (
                                <div key={log.id} className="p-2 sm:p-3 hover:bg-muted/50 transition-colors" data-testid="log-entry">
                                    <div className="flex items-start gap-2 sm:gap-3">
                                        <div className="shrink-0 pt-0.5">
                                            <Badge className={cn("text-[10px] px-1 py-0 h-5", getLevelColor(log.level))}>
                                                {log.level}
                                            </Badge>
                                        </div>
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex items-center gap-2 text-muted-foreground text-[10px] sm:text-xs">
                                                <span>{log.timestamp}</span>
                                                {(() => {
                                                    const component = log.context?.component;
                                                    if (component && typeof component === 'string') {
                                                        return (
                                                            <span className="font-semibold text-foreground">
                                                                [{component}]
                                                            </span>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                            <p className="break-all whitespace-pre-wrap">{log.message}</p>
                                            {log.args && log.args.length > 0 && (
                                                <LogCodeBlock
                                                    content={log.args.map(arg =>
                                                        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                                                    ).join('\n')}
                                                />
                                            )}
                                            {log.context && Object.keys(log.context).length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {Object.entries(log.context).map(([key, value]) => {
                                                        if (key === 'component') return null;
                                                        return (
                                                            <span key={key} className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                                                {key}: {String(value)}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
