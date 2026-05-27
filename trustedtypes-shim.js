// Trusted Types default policy shim. Loaded BEFORE jQuery and GM_config
// via @require so that they can use innerHTML on YouTube and other sites
// with strict Trusted Types CSP. Without this, jQuery 3.x and GM_config
// throw "This document requires 'TrustedHTML' assignment" at load time.
(function () {
    if (typeof window === 'undefined') return;
    if (!window.trustedTypes || !window.trustedTypes.createPolicy) return;
    if (window.trustedTypes.defaultPolicy) return;
    try {
        window.trustedTypes.createPolicy('default', {
            createHTML: function (input) { return input; },
            createScript: function (input) { return input; },
            createScriptURL: function (input) { return input; }
        });
    } catch (e) {
        // CSP may forbid creating 'default' policy on some pages — non-fatal
    }
})();
