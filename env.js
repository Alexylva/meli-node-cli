/**
 * Configurations
**/
const path = require('dotenv').config();
let app_id = process.env.APP_ID;
let secret = process.env.SECRET;
let session_path = process.env.SESSION_PATH;

if (!app_id || !secret || !session_path) {
    //const readline = require('readline');
    //const fs = require('fs');
    console.log(`Please set your environment variables on "${process.cwd()}\\.env"`);
    process.exit(1);
}

function getAppKeys() {
    return {app_id, secret};
}

module.exports = {
    getAppKeys,
    session_path
}