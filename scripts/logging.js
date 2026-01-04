window.Logger = (function() {
    const logs = [];

    function timestamp() {
        return new Date().toISOString().split('T')[1].slice(0, -1);
    }

    function format(category, msg, data = null) {
        let output = `[${timestamp()}] [${category}] ${msg}`;
        logs.push(output);
        if (data !== null) {
            console.groupCollapsed(output);
            console.log(data);
            const dataStr = JSON.stringify(data, null, 2);
            logs.push(dataStr);
            console.groupEnd();
        } else {
            console.log(output);
        }
    }

    return {
        info: (msg, data) => format('INFO', msg, data),
        warn: (msg, data) => format('WARN', msg, data),
        error: (msg, data) => format('ERROR', msg, data),
        test: (msg, data) => format('TEST', msg, data),
        interaction: (element, action, value = null) => {
            const valStr = value !== null ? ` -> ${value}` : '';
            format('INTERACTION', `${action} on ${element}${valStr}`);
        },
        state: (key, value) => format('STATE', `${key} = ${JSON.stringify(value)}`),
        undo: (index, total, action) => format('UNDO', `Action: ${action} | Index: ${index}/${total}`),
        brush: (type, nodes) => format('BRUSH', `${type} stroke completed with ${nodes} nodes`),
        getLogs: () => logs.join('\n'),
        clear: () => { logs.length = 0; }
    };
})();
