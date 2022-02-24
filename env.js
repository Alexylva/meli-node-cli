/**
 * Configurations
**/

const path = require('dotenv').config();
let app_id = process.env.APP_ID;
let secret = process.env.SECRET;
let session_path = process.env.SESSION_PATH;

function setup() {
    if (!app_id || !secret || !session_path) {
        return new Promise(resolve => buildEnv(resolve));
    }
    return Promise.resolve();
}

async function buildEnv(resolve) {
    const { createInterface } = require('readline');
    const { join } = require('path');
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const DEFAULT_PATH = join(process.cwd(), "/.session/",  "session.json");

    let aid  = await question('Insert APP_ID: ');
    let sct  = await question('Insert your APP_SECRET: ');
    let path = await question(`Change default session path? (${DEFAULT_PATH}) [y/N] `, 
        async (answer, resolve) => {
            let path;
            switch (answer) {
                case 'Y': case 'y':
                    path = await question(`Insert dirpath for session file: `);
                    path = join(path, 'session.json');
                    break;
                default:
                    path = DEFAULT_PATH;
            }
            return resolve (path);
    });

    saveEnv(aid, sct, path);
    resolve(true);
    rl.close();

    function question(prompt, callback) {
        return new Promise(resolve => { rl.question(prompt, (answer) => { 
            if (!callback) {
                resolve(answer);
                return;
            }
            callback(answer, resolve);
        }); });
    }
};

function saveEnv(aid, sct, path) {
    const fs = require('fs');
    fs.writeFileSync(".\\\.env", `#env_file\nAPP_ID=${aid}\nSECRET=${sct}\nSESSION_PATH=${path}`);
}

function getAppKeys() {
    return {app_id, secret};
}

module.exports = {
    setup,
    getAppKeys,
    session_path
}