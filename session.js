/**
 * Session Data
**/
const DEFAULT_SLOT = 'main';

const session = loadSession() || {};
session.slot = session.slot || DEFAULT_SLOT;

module.exports = {
  saveSession() {
    storeData(session, session_file);
  },
  setSlot(slot) {
    session.slot = slot;
  }
  getSlots() {
    let props = [];
    for (prop in obj) props.push(prop);
    console.log(props); 
  }
  getSession() {
    return session[session.slot];
  }

  getAccessToken() {
    let { access_token } = getSession();
    console.log(access_token, true, false);
    return access_token;
  }

  setAccessToken() {
    if (session[slot]) session[slot].access_token = token;
  }
}


function loadSession() {
    return loadData(session_file);
}

function setAccessToken(data) {
    session[slot].tokenDetails = data;
    session[slot].access_token = data.access_token;; //Update Session Access Token
    saveSession();
}

/**
 * File Management
**/

function storeData (data, path) {
  if (!fs.existsSync(path.dir)){
  fs.mkdirSync(path.dir, {recursive: true});
  }
  try {
    fs.writeFileSync(path.path(), JSON.stringify(data, null, 2))
  } catch (err) {
    console.error(err)
  }
}

function loadData (path) {
  try {
    return JSON.parse(fs.readFileSync(path.path(), 'utf8'));
  } catch (err) {
    return false
  }
}