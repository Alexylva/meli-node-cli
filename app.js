const env = require('./env');
const sessionApi = require('./sessionApi');
const mlApi = require('./mlApi');
const http = require('./http');
const repl = require('./repl')

env.setup().then(() => {
    sessionApi.setup(env.session_path).then(() => {
        mlApi.setup(sessionApi.getAccessToken, sessionApi.setAccessToken, env.getAppKeys).then(() => {
            http.setup(mlApi, sessionApi).then(() => {
                repl.setup(sessionApi, mlApi)
            })
        })
    })
})


