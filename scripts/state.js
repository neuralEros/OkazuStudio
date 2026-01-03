// State factory (browser-only global namespace)
(function() {
    function createState(overrides = {}) {
        return {
            ...overrides
        };
    }

    window.StateFactory = {
        createState
    };
})();
