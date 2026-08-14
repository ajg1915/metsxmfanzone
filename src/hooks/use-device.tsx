import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;
const TV_BREAKPOINT = 1920;

type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'tv';

// TV User Agent patterns for smart TV browsers
const TV_USER_AGENTS = [
  'SmartTV',
  'SMART-TV',
  'WebOS',
  'Tizen',
  'BRAVIA',
  'CrKey', // Chromecast
  'AFT', // Amazon Fire TV
  'Roku',
  'Xbox',
  'PlayStation',
  'AppleTV',
  'GoogleTV',
  'Vizio',
  'HbbTV',
  'NetCast',
  'NETTV',
  'Philips',
  'Opera TV',
  'Hisense',
  'VIDAA',
];

function detectTVUserAgent(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const userAgent = navigator.userAgent;
  return TV_USER_AGENTS.some(tvAgent => userAgent.includes(tvAgent));
}

function getURLTVParam(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('tv') === 'true';
}

function getStoredTVPreference(): boolean | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const stored = localStorage.getItem('tv-mode');
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return null;
}

export function setTVModePreference(enabled: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('tv-mode', String(enabled));
  }
}

export function useDevice() {
  const [deviceType, setDeviceType] = React.useState<DeviceType>('desktop');
  const [isTVDetected, setIsTVDetected] = React.useState(false);

  React.useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const screenWidth = typeof screen !== 'undefined' ? screen.width : width;
      const isTVUserAgent = detectTVUserAgent();
      const isTVParam = getURLTVParam();
      const storedPreference = getStoredTVPreference();
      
      // TV detection priority: URL param > stored preference > user agent > screen size
      // Use both innerWidth and screen.width since TV browsers may scale the viewport
      const isLargeScreen = width >= TV_BREAKPOINT || screenWidth >= TV_BREAKPOINT;
      const isSmallViewport = width < TABLET_BREAKPOINT;
      const isTV = !isSmallViewport && (
                   isTVParam || 
                   storedPreference === true || 
                   isTVUserAgent || 
                   (isLargeScreen && storedPreference !== false));
      
      setIsTVDetected(isTV);
      
      if (isTV) {
        setDeviceType('tv');
      } else if (width < MOBILE_BREAKPOINT) {
        setDeviceType('mobile');
      } else if (width < TABLET_BREAKPOINT) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    checkDevice();
    
    const mql = window.matchMedia(`(min-width: ${TV_BREAKPOINT}px)`);
    const mqlTablet = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);
    const mqlMobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    const onChange = () => checkDevice();
    
    mql.addEventListener("change", onChange);
    mqlTablet.addEventListener("change", onChange);
    mqlMobile.addEventListener("change", onChange);
    
    return () => {
      mql.removeEventListener("change", onChange);
      mqlTablet.removeEventListener("change", onChange);
      mqlMobile.removeEventListener("change", onChange);
    };
  }, []);

  return {
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isTV: deviceType === 'tv',
    isTVDetected,
  };
}

// Backward compatibility
export function useIsMobile() {
  const { isMobile } = useDevice();
  return isMobile;
}
