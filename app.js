const env = require('./env');

const sessionApi = require('./sessionApi');
sessionApi.setup(env.session_path);

const mlApi = require('./mlApi');
mlApi.setup(sessionApi.getAccessToken, sessionApi.setAccessToken, env.getAppKeys);

const http = require('./http');
http.setup(env.getAppKeys, sessionApi, mlApi.fetchAccessToken);

const repl = require('./repl')
repl.setup(sessionApi, mlApi);
