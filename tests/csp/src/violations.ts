declare global {
  interface Window {
    __cspViolations: Array<{
      effectiveDirective: string;
      blockedURI: string;
    }>;
    __viewerReady?: boolean;
  }
}

window.__cspViolations = [];
window.addEventListener('securitypolicyviolation', (event) => {
  window.__cspViolations.push({
    effectiveDirective: event.effectiveDirective,
    blockedURI: event.blockedURI,
  });
});

export {};
