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

    hostname = 'localhost';
    port = 63771; //🤔 Perhaps choose port at random?
    server_url = `http://${hostname}:${port}/`
    auth_resource = `code`;
    auth_url = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${getAppKeys().app_id}&redirect_uri=${server_url}${auth_resource}`
    Object.assign(module.exports, { server_url, auth_resource, port, auth_url });
    resolve();
  })
}

async function fetchAccessToken(auth) {
  const appkeys = getAppKeys();
  const response = await request('oauth/token', 'POST', 
    `grant_type=authorization_code
     &client_id=${appkeys.app_id}
     &client_secret=${appkeys.secret}
     &code=${auth}
     &redirect_uri=${server_url}${auth_resource}`, {
    'accept': 'application/json',
    'content-type': 'application/x-www-form-urlencoded'},
  );
  return response.json();
}

// .changeSku MLB2181674098 174214094869 SUCCESSSKU
async function changeSku(mlb, vari, sku, verbose = false) {
  if (!isMLBValid(mlb)) throw new Error("Invalid MLB");

  if (isVariValid(vari)) {
    _changeSkuVari(mlb, vari, sku); //Has variation
  } else {
    _changeSkuReg(mlb, sku); //Hasn't
  }
}

async function getMe() {
  const response = await request('users/me');
  return response.json();
}

async function getItem(mlb) {
  const response = await request(`items/${mlb}`);
  return response.json();
}

async function createTestUser() {
  const response = await request('users/test_user', 'POST', {"site_id":"MLB"});
  const data = response.json();
  if (!isError(data)) {
    return data;
  } else {
    throw new Error("Couldn't create new Test User.\n" + data);
  }
}

module.exports = {
  setup,
  fetchAccessToken,
  changeSku,
  getMe,
  getItem,
  createTestUser
}

/**
 * Auxiliary API Functions
 */

async function _changeSkuVari(mlb, vari, sku) {
  console.log(`Changing SKU for ${mlb}${vari} to ${sku}`);

  const item = getItem(mlb);
  if (isError(item)) throw new Error("Error fetching item.");

  return;

  const response = request(`items/${mlb}`, 'PUT', {
      variations: [{
          id: vari,
          seller_custom_field: sku
      }]
  });
  const data = await response.json();

  if (data.warnings || !silent) console.log(`Server Answer: ${JSON.stringify(data, null, 2)}`, true);
}

async function _changeSkuReg(mlb, sku) {
  throw new Error("Not implemented!");
}


/**
 * Request Shorthands
 */

async function request(path, method = 'GET', body = '', headers = makeHeaders()) {
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
  return await fetch(API_URL + path, options);
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