/**
 * Meli Node CLI is a command-line implementation of Mercado Livre API.
 * Copyright (C) 2022  Alexylva
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>. 
 */


function main(args) {
    const env = require('./env');
    const sessionApi = require('./sessionApi');
    const mlApi = require('./mlApi');
    const http = require('./http');
    const repl = require('./repl');

    env.setup().then(async () => {
        await sessionApi.setup(env.session_path);
        await mlApi.setup(sessionApi.getAccessToken, sessionApi.setAccessToken, env.getAppKeys);
        await http.setup(mlApi.fetchAccessToken, sessionApi, env.getAppKeys);
        await repl.setup(sessionApi, mlApi);
    });
}

main(process.argv);