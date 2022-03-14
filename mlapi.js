/**
 * API Implementation
**/
let fetch = require('node-fetch');
//fetch = (...a) => { console.log(JSON.stringify(a)); return { json() {return {}; }} };

let setAccessToken, getAccessToken, getAppKeys;
const API_URL = 'https://api.mercadolibre.com/';

function setup(accessTokenGetter, accessTokenSetter, appKeysGetter) {
  return new Promise (resolve => {
    [ getAccessToken , setAccessToken , getAppKeys ] = 
    [ accessTokenGetter, accessTokenSetter, appKeysGetter ];
    resolve();
  })
}

function fetchAccessToken(auth, redirect_uri) {
  const appkeys = getAppKeys();
  return request('oauth/token', 'POST', 
    `grant_type=authorization_code
     &client_id=${appkeys.app_id}
     &client_secret=${appkeys.secret}
     &code=${auth}
     &redirect_uri=${redirect_uri}`, {
    'accept': 'application/json',
    'content-type': 'application/x-www-form-urlencoded'},
  );
}

function getMe() {
  return request('users/me');;
}

function getItem(mlb) {
  return request(`items/${mlb}`);
}
function getItemVari(mlb, vari) {
  return request(`items/${mlb}/variations/${vari}`);
}



// .changeSku MLB2181674098 174214094869 SUCCESSSKU
function changeSku(mlb, vari, sku, verbose = false) {
  if (!isMLBValid(mlb)) throw new Error("Invalid MLB");

  if (isVariValid(vari)) {
    _changeSkuVari(mlb, vari, sku); //Has variation
  } else {
    _changeSkuReg(mlb, sku); //Hasn't
  }
}

function createTestUser() {
  const response = request('users/test_user', 'POST', {"site_id":"MLB"});
  if (!isError(response)) {
    return response;
  } else {
    throw new Error("Couldn't create new Test User.\n" + response);
  }
}

module.exports = {
  setup,
  fetchAccessToken,
  changeSku,
  getMe,
  getItem,
  getItemVari,
  createTestUser
}

/**
 * Auxiliary API Functions
 */

async function _changeSkuVari(mlb, vari, sku) {
  console.log(`Changing SKU for ${mlb}/${vari} to ${sku}`);

  const item = await getItemVari(mlb,vari);
  if (isError(item)) return onErr(item.message);

  createBackup(item);

  if (!Array.isArray(item.attributes)) item.attributes = [];

  item.attributes.push({
    id: "SELLER_SKU",
    value_name: sku
  })

  const response = request(`items/${mlb}/variations/${vari}`, 'PUT', {
    id: vari,
    attributes: item.attributes
  });
  let data = await response;
  data = data[0];

  if (data.warnings) {
    console.log(`Server Answer: ${JSON.stringify(data, null, 2)}`, false);
  } else {
    if (!Array.isArray(data.attributes)) return onErr("Unknown Return Data\n" + JSON.stringify(data,null,2));
    let i = data.attributes.findIndex(elem => elem.id && elem.id === 'SELLER_SKU');
    if (data.attributes[i].value_name && data.attributes[i].value_name === sku) {
      console.log(`${mlb}/${vari} SKU is now ${sku}`, false, false);
    } else {
      return onErr("SKU wasn't set correctly\n" + JSON.stringify(data,null,2));
    }  
  }  
}

async function _changeSkuReg(mlb, sku) {
  throw new Error("Not implemented!");
}


/**
 * Request Shorthands
 */

function request(path, method = 'GET', body = '', headers = makeHeaders()) {
  const options = {
    method,
    headers
  };
  if (body) {
    if (typeof body === 'string') {
      options.body = body;
    } else if (typeof body === 'object') {
      options.body = JSON.stringify(body);
    }
  }
  return fetch(API_URL + path, options).then(response => response.json());
}

function makeHeaders() {
  const access_token = getAccessToken();
  return {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
    }
  }


/**
 * Validity Functions
 */

function isVariValid(vari){
  return /^\d{7,12}$/.test(vari);
}

function isMLBValid(mlb) {
  return /^ML[A-Z]\d{9,11}$/.test(mlb);
}

function isError(response) {
  return (typeof response.error !== 'undefined' || (typeof response.status !== 'undefined' && response.status >= 300));
}

function onErr(e) {
  console.log(e, true, false);
  return undefined;
}

/**
 * Backup Functions
 */
//TODO
let fs, path;
function createBackup(item, ...tags) {
  fs = fs ||require('fs');
  path = path || require('path');

  fs.writeFile(path.join(BACKUP_PATH, `${tags.join('-')} ${item.id} ` , )

}