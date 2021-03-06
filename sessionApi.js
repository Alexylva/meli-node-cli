/**
 * Session Data
**/
const DEFAULT_SLOT = 'main';

let session_file, session, auth_url;

function setup(filename) {
  return new Promise(resolve => {
    session_file = filename;
    session = loadSession(session_file);
    resolve();
  })
}

function getSession() {
  if (!hasSession()) createSession(); 
  return session.profiles[session.profile];
}

function setAuth(auth) {
  getSession().auth = auth;
  saveSession();
}

function createSession() {
  if (!hasSessionProfile()) session.profile = 'main';
  if (!hasSessionProfiles()) session.profiles = {};
  session.profiles[session.profile] = {};
  saveSession();
}

function hasSession() {
  if (!hasSessionProfile()) return false;
  if (!hasSessionProfiles()) return false;
  if (session.profiles[session.profile]) return true;
}

function hasSessionProfile() {
  return typeof session.profile === 'string';
}

function hasSessionProfiles() {
  return typeof session.profiles === 'object';
}

function saveSession() {
  storeData(session, session_file);
}

function setProfile(profile) {
  session.profile = profile;
  saveSession();
}

function getProfileNames() {
  return Object.keys(session.profiles);
}

function getProfile() {
  return session.profile;
}

function verifyAccessToken (url) {
  auth_url = url;
  //Perhaps add date validity?
  if (!hasAccessToken()) requestNewAccessToken(url);
}

function newAccessToken() {
  delete getSession().access_token;
  delete getSession().token_details;
  requestNewAccessToken(auth_url);
  saveSession();
}

function requestNewAccessToken(auth_url) {
  console.log(`Use this link to get the token ${auth_url}`);
}

function hasAccessToken() { //Maybe add a validity check later?
  return (typeof getSession().access_token !== 'undefined' && getSession().access_token !== '');
}

function getAccessToken() {
  if (!hasAccessToken()) return;
  return getSession().access_token;
}

function setAccessToken(token, data = undefined) {
  getSession().token_details = data; //May undefine
  getSession().access_token = token;
  saveSession();
}

function hasTestUsers() {
  let s = getSession();
  if (!s.testUsers || !Array.isArray(s.testUsers)) return false;
  return getSession().testUsers.length;
}

function addTestUser(user) {
  let s = getSession();
  if (!s.hasTestUsers()) s.testUsers = [];
  s.testUsers.push(user);
  saveSession();
}

function getTestUsers() {
  let s = getSession();
  if (!s.hasTestUsers() > 0) return false;
  return s.testUsers;
}

module.exports = {
  setup,
  getSession,
  getProfileNames,
  saveSession,
  setProfile,
  newAccessToken,
  verifyAccessToken,
  setAccessToken,
  getAccessToken,
  hasAccessToken,
  hasTestUsers,
  addTestUser,
  getTestUsers,
  getProfile,
  setAuth
}

function loadSession(session_file) {
  let session = loadData(session_file) || {};
  session.profile = session.profile || DEFAULT_SLOT;
  return session;
}

/**
 * File Management
**/
const path = require('path');
const fs = require('fs');

function storeData(data, session_file) {
  session_file = path.resolve(session_file); //Make absolute path
  if (!fs.existsSync(path.dirname(session_file))) {
    fs.mkdirSync(path.dirname(session_file), { recursive: true });
  }
  try {
    fs.writeFileSync(path.resolve(session_file), JSON.stringify(data, null, 2))
  } catch (err) {
    console.error(err)
  }
}

function loadData(session_file) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(session_file), 'utf8'));
  } catch (err) {
    return false
  }
}