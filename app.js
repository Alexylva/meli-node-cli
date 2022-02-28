
function main(args) {
    const env = require('./env');
    const sessionApi = require('./sessionApi');
    const mlApi = require('./mlApi');
    const http = require('./http');
    const repl = require('./repl');

    env.setup().then(async () => {
        await sessionApi.setup(env.session_path);
        await mlApi.setup(sessionApi.getAccessToken, sessionApi.setAccessToken, env.getAppKeys);
        await http.setup(mlApi, sessionApi);
        await repl.setup(sessionApi, mlApi);
    });
}

main(process.argv);