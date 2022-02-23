/**
 * Configurations
**/
const path = require('dotenv').config();
let app_id = process.env.APP_ID;
let secret = process.env.SECRET;
let session_path = process.env.SESSION_PATH;

checkEnv();

function checkEnv() {
    if (!app_id || !secret || !session_path) {
        buildEnv();
    }
}

async function buildEnv() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    await rl.question('Insert your APP_ID: ', (aid) => {
        r1.question('Insert your APP_SECRET: ', (sct) => {
            r1.question(`Leave default session path? (${process.cwd()}\\.session\\) [y/N]`, (answer) => {
                let path;
                switch (answer) {
                    case 'Y':
                    case 'y':
                        r1.question(`Insert dirpath for session file: `, (path) => {
                            path = require('path').join(path, 'session.json');
                        })
                        break;
                    default:
                        path = "./.session/session.json";
                }
                saveEnv(aid, sct, path);
                rl.close();
            })
        })
    });

}

function saveEnv(aid, sct, path) {
    const fs = require('fs');
    fs.writeFileSync(".\.env", `#env_file\nAPP_ID=${aid}\nSECRET=${sct}\nSESSION_PATH=${path}`);
}

function getAppKeys() {
    return {app_id, secret};
}

module.exports = {
    getAppKeys,
    session_path
}

//#.env file
//APP_ID=7740117095200548 
//SECRET=ssxPhWJcrPYTJm3NZLqrwDNOhrugS7qk