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
  'AFT', // Amazon Fire TV (Fire Stick, Fire TV, Fire TV Cube report AFTxx models)
  'Android TV',
  'AndroidTV',
  'Chromecast',
  'MiBOX',
  'SHIELD',
  'MetsXMFanZoneTV', // our own TV app
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

/** True on phones. TV mode is offered on PCs, tablets and TVs, not phones. */
export function isPhoneUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mobile|iPhone|iPod/i.test(navigator.userAgent) && !detectTVUserAgent();
}

/** Switch the page the member is on into TV mode (the same mode ?tv=true turns on). */
export function enterTVMode() {
  setTVModePreference(true);
  window.location.reload();
}

export function useDevice() {
  const [deviceType, setDeviceType] = React.useState<DeviceType>('desktop');
  const [isTVDetected, setIsTVDetected] = React.useState(false);
  // True only for a real TV (TV browser/app, ?tv=true, remembered choice) — not the large-screen guess
  const [isTVDevice, setIsTVDevice] = React.useState(false);

  React.useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const screenWidth = typeof screen !== 'undefined' ? screen.width : width;
      const isTVUserAgent = detectTVUserAgent();
      const isTVParam = getURLTVParam();
      const storedPreference = getStoredTVPreference();
      
      // Strong signals: a TV browser or TV app, ?tv=true, or a remembered TV choice.
      // TVs often report a small CSS viewport (960px is common for 1080p screens),
      // so strong signals must not be blocked by the viewport size.
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isPhoneUA = /Mobile|iPhone|iPod/i.test(ua) && !isTVUserAgent;
      const isLargeScreen = width >= TV_BREAKPOINT || screenWidth >= TV_BREAKPOINT;
      const isSmallViewport = width < TABLET_BREAKPOINT;

      // A TV device or ?tv=true remembers itself, so later visits open in TV mode.
      if ((isTVUserAgent || isTVParam) && storedPreference === null) {
        setTVModePreference(true);
      }

      // "Exit TV Mode" stores false and wins over everything except ?tv=true.
      const optedOut = storedPreference === false && !isTVParam;
      const strong = isTVParam || isTVUserAgent || (storedPreference === true && !isPhoneUA);
      const weak = isLargeScreen && !isSmallViewport;
      const isTV = !optedOut && (strong || weak);

      setIsTVDetected(isTV);
      setIsTVDevice(!optedOut && strong);
      
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
    isTVDevice,
  };
}

// Backward compatibility
export function useIsMobile() {
  const { isMobile } = useDevice();
  return isMobile;
}
