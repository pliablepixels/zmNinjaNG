/**
 * App Layout Component
 *
 * The main layout component for the application.
 * It provides the responsive sidebar navigation, mobile header, and main content area.
 * It also handles the sidebar resizing logic and mobile drawer state.
 */

import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';
import { useProfileStore } from '../../stores/profile';
import { useNotificationStore } from '../../stores/notifications';
import { useSettingsStore } from '../../stores/settings';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../ui/button';
import { ModeToggle } from '../mode-toggle';
import { log, LogLevel } from '../../lib/logger';
import { ProfileSwitcher } from '../profile-switcher';
import { useToast } from '../../hooks/use-toast';
import { useInsomnia } from '../../hooks/useInsomnia';
import {
  LayoutGrid,
  Video,
  Clock,
  ChartGantt,
  Settings,
  Menu,
  Users,
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  LayoutDashboard,
  Server,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '../ui/sheet';
import { useTranslation } from 'react-i18next';
import { BackgroundTaskDrawer } from '../BackgroundTaskDrawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface SidebarContentProps {
  onMobileClose?: () => void;
  isCollapsed?: boolean;
}

/**
 * Language Switcher Component
 * Renders a dropdown to switch the application language.
 */
function LanguageSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'en', label: t('languages.en') },
    { code: 'es', label: t('languages.es') },
    { code: 'fr', label: t('languages.fr') },
    { code: 'de', label: t('languages.de') },
    { code: 'zh', label: t('languages.zh') },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2 gap-1 ml-1",
            collapsed && "w-8 p-0 justify-center ml-0 mt-2"
          )}
          title={t('sidebar.switch_language')}
          data-testid="language-switcher"
        >
          <Globe className="h-4 w-4" />
          {!collapsed && (
            <span className="text-xs uppercase font-medium">{i18n.language?.split('-')[0] || 'en'}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className="text-xs"
            data-testid={`language-option-${lang.code}`}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Sidebar Content Component
 * Renders the navigation links and user controls within the sidebar.
 */
function SidebarContent({ onMobileClose, isCollapsed }: SidebarContentProps) {
  const location = useLocation();
  const currentProfile = useProfileStore(
    useShallow((state) => {
      const { profiles, currentProfileId } = state;
      return profiles.find((p) => p.id === currentProfileId) || null;
    })
  );
  const { getUnreadCount, connectionState, getProfileSettings } = useNotificationStore(
    useShallow((state) => ({
      getUnreadCount: state.getUnreadCount,
      connectionState: state.connectionState,
      getProfileSettings: state.getProfileSettings,
    }))
  );
  const { getProfileSettings: getSettings, updateProfileSettings } = useSettingsStore(
    useShallow((state) => ({
      getProfileSettings: state.getProfileSettings,
      updateProfileSettings: state.updateProfileSettings,
    }))
  );

  // Get notification data for current profile
  const unreadCount = currentProfile ? getUnreadCount(currentProfile.id) : 0;
  const settings = currentProfile ? getProfileSettings(currentProfile.id) : null;
  const profileSettings = currentProfile ? getSettings(currentProfile.id) : null;

  const { t } = useTranslation();
  const { toast } = useToast();

  const handleInsomniaToggle = () => {
    if (currentProfile && profileSettings) {
      const newValue = !profileSettings.insomnia;
      updateProfileSettings(currentProfile.id, { insomnia: newValue });
      toast({
        description: t(newValue ? 'montage.insomnia_enabled' : 'montage.insomnia_disabled'),
      });
    }
  };


  const navItems = [
    { path: '/dashboard', label: t('sidebar.dashboard'), icon: LayoutDashboard },
    { path: '/monitors', label: t('sidebar.monitors'), icon: Video },
    { path: '/montage', label: t('sidebar.montage'), icon: LayoutGrid },
    { path: '/events', label: t('sidebar.events'), icon: Clock },
    { path: '/timeline', label: t('sidebar.timeline'), icon: ChartGantt },
    { path: '/notifications', label: t('sidebar.notifications'), icon: Bell },
    { path: '/profiles', label: t('sidebar.profiles'), icon: Users },
    { path: '/settings', label: t('sidebar.settings'), icon: Settings },
    { path: '/server', label: t('sidebar.server'), icon: Server },
    { path: '/logs', label: t('sidebar.logs'), icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={cn("p-6 transition-all duration-300", isCollapsed && "p-2 flex flex-col items-center")}>
        <div className={cn("flex items-center gap-2 mb-1", isCollapsed && "flex-col mb-2")}>
          <img src="/logo.png" alt={t('app.logo_alt')} className="h-8 w-8 rounded-lg" />
          {!isCollapsed && (
            <>
              <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">{t('app.name')}</h1>
              <LanguageSwitcher />
            </>
          )}
        </div>
        {isCollapsed && <LanguageSwitcher collapsed />}
        {!isCollapsed && currentProfile && (
          <p className="text-xs text-muted-foreground font-medium px-1 truncate">
            {currentProfile.name}
          </p>
        )}
      </div>

      <div className="flex-1 px-3 py-2 overflow-y-auto">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => onMobileClose?.()}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? item.label : undefined}
                data-testid={`nav-item-${item.path.replace('/', '')}`}
              >
                <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110 flex-shrink-0", isActive && "text-primary-foreground")} />
                {!isCollapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    
                    {item.path === '/notifications' && (() => {
                      const statusLabel =
                        !settings?.enabled ? t('notifications.status.disabled') :
                        settings?.notificationMode === 'direct' ? t('notifications.status.direct_active') :
                        connectionState === 'connected' ? t('notifications.status.connected') :
                        connectionState === 'disconnected' ? t('notifications.status.disconnected') :
                        t('notifications.status.connecting');
                      const dotColor =
                        !settings?.enabled ? "bg-muted-foreground/50" :
                        settings?.notificationMode === 'direct' ? "bg-blue-400" :
                        connectionState === 'connected' ? "bg-green-500" :
                        connectionState === 'disconnected' || connectionState === 'error' ? "bg-red-500" :
                        "bg-orange-500 animate-pulse";
                      return (
                        <div
                          className={cn("h-2 w-2 rounded-full ml-2 flex-shrink-0", dotColor)}
                          title={statusLabel}
                          role="status"
                          aria-live="polite"
                          aria-label={statusLabel}
                          data-testid="notification-status-indicator"
                        />
                      );
                    })()}

                    {item.path === '/notifications' && unreadCount > 0 && (
                      <span className="ml-auto h-5 min-w-5 px-1.5 flex items-center justify-center text-xs font-bold rounded-full bg-destructive text-destructive-foreground flex-shrink-0">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={cn("border-t bg-card/50 backdrop-blur-sm space-y-3 transition-all duration-300", isCollapsed ? "p-2" : "p-4")}>
        {!isCollapsed ? (
          <>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground px-1">{t('sidebar.profile')}</span>
              <ProfileSwitcher />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-muted-foreground">{t('settings.theme')}</span>
              <ModeToggle />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-muted-foreground">{t('monitor_detail.insomnia_label')}</span>
              <Button
                onClick={handleInsomniaToggle}
                variant={profileSettings?.insomnia ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                title={profileSettings?.insomnia ? t('montage.insomnia_enabled') : t('montage.insomnia_disabled')}
                data-testid="sidebar-insomnia-toggle"
              >
                {profileSettings?.insomnia ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <Button
            onClick={handleInsomniaToggle}
            variant={profileSettings?.insomnia ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            title={profileSettings?.insomnia ? t('montage.insomnia_enabled') : t('montage.insomnia_disabled')}
            data-testid="sidebar-insomnia-toggle-collapsed"
          >
            {profileSettings?.insomnia ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * AppLayout Component
 * The main layout wrapper that includes the sidebar and main content area.
 */
export default function AppLayout() {
  const { currentProfile, settings } = useCurrentProfile();
  const updateProfileSettings = useSettingsStore((state) => state.updateProfileSettings);
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256); // 256px = w-64
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const MIN_WIDTH = 60;
  const MAX_WIDTH = 256;
  const { t } = useTranslation();

  // Track route changes and save to settings
  useEffect(() => {
    if (!currentProfile?.id) return;

    // Exclude setup/profile routes from being saved as lastRoute
    const excludedRoutes = ['/profiles/new', '/setup', '/profiles'];
    const shouldSave = !excludedRoutes.includes(location.pathname);

    if (shouldSave) {
      updateProfileSettings(currentProfile.id, { lastRoute: location.pathname });
      log.app('Storing route', LogLevel.DEBUG, { route: location.pathname });
    }
  }, [location.pathname, currentProfile?.id, updateProfileSettings]);

  // Apply global insomnia setting
  useInsomnia({ enabled: settings.insomnia });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const delta = e.clientX - dragStartX.current;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Check for profile after all hooks are called to avoid hooks violation
  // Allow /profiles route without a current profile (for profile selection after cancel)
  // Otherwise redirect to profile selection or new profile setup
  if (!currentProfile) {
    // Don't redirect if already on profiles page
    if (location.pathname === '/profiles') {
      // Allow access to profiles page without a current profile
    } else {
      const profiles = useProfileStore.getState().profiles;
      return <Navigate to={profiles.length > 0 ? "/profiles" : "/profiles/new"} replace />;
    }
  }

  const toggleSidebar = () => {
    setSidebarWidth(sidebarWidth > MIN_WIDTH + 20 ? MIN_WIDTH : MAX_WIDTH);
  };

  const isCollapsed = sidebarWidth <= MIN_WIDTH + 20;

  return (
    <div className="flex fixed inset-0 bg-background overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {/* Desktop Sidebar - Draggable */}
      <aside
        className="hidden md:flex flex-col border-r bg-card/50 backdrop-blur-xl z-20 transition-all duration-300 relative group"
        style={{ width: `${sidebarWidth}px` }}
      >
        <SidebarContent isCollapsed={isCollapsed} />

        {/* Draggable Handle with Toggle Button */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-12 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center cursor-col-resize shadow-lg z-50 transition-all duration-200 group-hover:w-6"
          onMouseDown={handleMouseDown}
          onClick={toggleSidebar}
          title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          data-testid="sidebar-toggle"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-primary-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-primary-foreground" />
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-[calc(3rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] border-b bg-background z-30 flex items-center px-3 justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt={t('app.logo_alt')} className="h-8 w-8 rounded-lg" />
          <span className="font-bold">{t('app.name')}</span>
          <LanguageSwitcher />
        </div>
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="mobile-menu-button">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 sm:w-72 flex flex-col pt-[env(safe-area-inset-top)]">
            <SheetTitle className="sr-only">{t('app.navigation_menu')}</SheetTitle>
            <SheetDescription className="sr-only">{t('app.navigation_menu_desc')}</SheetDescription>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent onMobileClose={() => setIsMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative w-full pt-[calc(3rem+env(safe-area-inset-top))] md:pt-0 pb-[env(safe-area-inset-bottom)]">
        {/* Background gradient blob for visual interest */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent -z-10 pointer-events-none" />

        <Outlet />
      </main>

      {/* Global Background Task Drawer */}
      <BackgroundTaskDrawer />
    </div>
  );
}
