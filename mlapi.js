/**
 * API Implementation
**/
let fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { cursorTo } = require('readline');
const [SUCCESS, FAILURE] = [ Symbol("Success"), Symbol("Failure") ];

/**
 * Constants
 */
let setAccessToken, getAccessToken, getAppKeys;
const API_URL = 'https://api.mercadolibre.com/';
const API_INTERVAL = 700;//ms
const BACKUP_PATH = "./.backups/"; // ❕ Later move to constants file?

function setup(accessTokenGetter, accessTokenSetter, appKeysGetter) {
  return new Promise (resolve => {
    [ getAccessToken , setAccessToken , getAppKeys ] = 
    [ accessTokenGetter, accessTokenSetter, appKeysGetter ];
    resolve();
  })
}

/**
 * Used to send a request to ML API for a Access Token, that gives access to most functions.
 * 
 * @param {string} auth Auth token used to generate Access Token
 * @param {string} redirect_uri URI for where the server will send the Access Token.
 * @returns Promise for the token data.
 */
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

/**
 * Implements the users/me API function, which returns current user data.
 * 
 * @returns Promise for the users/me response.
 */
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

function batchChangeSku(file) {
  return new Promise((resolve) => {
    let csv = require('jquery-csv');
    let fileContent;

    try {
      fileContent = fs.readFileSync(path.resolve(file), 'UTF-8');
    } catch(e) { 
      return onErr("File not found", e);
    }

    let data = csv.toArrays(fileContent, {}, async (err, array) => { //Makes CSV into array
      if (err) return onErr("Error converting to CSV", e);

      for (let i = 1; i < array.length; i++) { //Loops through the array
        [mlb, vari, sku] = array[i];
        await new Promise((resolve) => { //Executes in set time interval synchronously to not overload the API.
          setTimeout(() => {
            console.log(`batch: [${i}/${array.length}] ${array[i]}`,false,false);
            changeSku(mlb, vari, sku);
            resolve();
          }, API_INTERVAL);
        })
      }
      resolve();
    });
  })
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
  batchChangeSku,
  getMe,
  getItem,
  getItemVari,
  createTestUser
}

/**
 * Auxiliary API Functions
 */

async function _changeSkuVari(mlb, vari, sku) {
  //Get original item
  const item = await getItemVari(mlb,vari);
  if (isError(item)) return onErr(item.message);
  
  //Get current attributes, their length and SKU
  if (!Array.isArray(item.attributes)) item.attributes = [];
  let oldLength = item.attributes.length;
  let currentSku = getSkuFromItem(item);

  //Check if it is necessary to replace the SKU, create backups
  if (currentSku === sku) {
    createBackup(mlb, item, 'vari', vari, 'sku', currentSku, 'unchanged');
    console.log(`SKU for ${mlb}/${vari} is already ${sku}`, false, false);
    return;
  } else {
    createBackup(mlb, item, 'vari', vari, 'sku', currentSku, 'to', sku);
  }

  //Changing SKU required, sends request to change
  return _changeSkuVariRequest(mlb, vari, sku);
}

async function _changeSkuVariRequest(mlb, vari, sku) {
  console.log(`Changing SKU for ${mlb}/${vari} to ${sku}`, false);

  //Push the sku into the item attributes.
  item.attributes.push({
    id: "SELLER_SKU",
    value_name: sku
  })

  //Perform the request
  const response = request(`items/${mlb}/variations/${vari}`, 'PUT', {
    id: vari,
    attributes: item.attributes
  });
  let data = await response;

  return _handleVariResponse(mlb, vari, sku, data);
}

function _handleVariResponse(mlb, vari, sku, data) {
  try {
    //Sanity check the response
    if (!data || !Array.isArray(data) || !Array.isArray(data.attributes)) 
      throw [onErr("Invalid response data.", JSON.stringify(data,null,2)), 'fail-sanity'];
    
      //Server answers with a array of all variations, choose the one with our ID to parse.
    data = data[data.findIndex(elem => elem.id && elem.id.toString() === vari)];
    if (!data)
      throw [onErr("Failed to find variation in response!"), data, 'fail-nosuchvari'];
    
    if (data.warnings) 
        throw  [onErr(`Warnings: ${JSON.stringify(data, null, 2)}`, false), 'warnings'];
    
    let newlen = data.attributes.length;
    let newsku = getSkuFromItem(data);
    if (newsku !== sku) {
      throw [onErr("SKU wasn't set correctly\n" + JSON.stringify(data,null,2), false), 'fail-skunotset'];
    } else {
      console.log(`${mlb}/${vari} SKU is now ${sku}`, false, false);
      createBackup(mlb, data, 'vari', vari, 'sku', currentSku, 'to', sku, 'new', oldLength, newlen);
    }  
  }
  }}
}

function getSkuFromItem(item) {
  let currsku;
  try {
    currsku = item.attributes[item.attributes.findIndex(elem => elem.id && elem.id === 'SELLER_SKU')].value_name;
  } catch (e) {
    currsku = "null";
  }
  return currsku;
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

function onErr(...e) {
  console.log(e.join("\n"), true, false);
  return FAILURE;
}

/**
 * Backup Functions
 */

function createBackup(mlb, item, ...tags) { // ❕ perhaps make async?
  let backup_path = path.resolve(BACKUP_PATH); //Make absolute path

  if (!fs.existsSync(backup_path)) {
    try {
    fs.mkdirSync(backup_path, { recursive: true });
    } catch (e) {
      return onErr("Error creating backups folder", e);
    }
  }

  let backup_file = path.join(backup_path, `${mlb} (${tags.join('-')} @ ${((new Date).valueOf())}).json`);
  // -> ./backups/90170897681 (vari-tairashop @ 1647448169214).json
  
  try {
    fs.writeFileSync(path.resolve(backup_file),  JSON.stringify(item, null, 2));
  } catch (err) {
    console.error(err);
  }

}