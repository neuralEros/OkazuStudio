// Action Log Backbone - Phase 1
// Centralized ActionHistory logger

(function() {
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    class ActionHistoryLog {
        constructor() {
            this.actions = [];
            this.cursor = -1; // For future replay/undo cursor
        }

        logAction(action) {
            const entry = {
                id: generateId(),
                timestamp: Date.now(),
                type: action.type,
                payload: action.payload
            };
            this.actions.push(entry);
            this.cursor = this.actions.length - 1;

            // Optional: Console log for verification
            console.log(`[ActionHistory] ${entry.type}`, entry.payload);
        }

        getLog() {
            return this.actions;
        }
    }

    window.ActionHistory = new ActionHistoryLog();

    window.dispatchAction = function(action) {
        if (!window.ActionHistory) {
            console.error("ActionHistory not initialized");
            return;
        }
        window.ActionHistory.logAction(action);
    };

})();
